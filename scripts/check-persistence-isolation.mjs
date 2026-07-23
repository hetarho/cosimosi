#!/usr/bin/env node
// Persistence-isolation gate ([U1], ARCHITECTURE §4): every product table owns a real
// user_id column, and every product statement is genuinely scoped by user_id on the
// tables it touches. The query check is alias-aware: it collects the statement's
// relations and its user_id equality predicates, then requires every product relation
// to be connected — directly or through user_id = user_id joins — to an external
// user-id parameter. SQL outside the supported grammar fails CLOSED (a violation with
// a location), never silently passes.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fail, ok, repoRoot, section } from './lib.mjs'

const platformQueryDirs = new Set(['platform'])
// The admin console (plan 58) is the one sanctioned cross-user surface (§4): its tables hold
// operator state (promoted admins, provider config, grant/audit records), not per-user product
// data, and every admin.v1 method is admin-authorization-gated. They carry no UserScope filter by
// design, so they are treated like platform tables here — exempt from the per-user isolation rule.
const platformTables = new Set([
  'admin_users',
  'ai_provider_keys',
  'ai_provider_config',
  'admin_stardust_grants',
  'admin_audit_log',
])
// Deliberately global statements, allowlisted by `<dir>/<file>#<sqlc name>`. Each must be a
// platform-owned scan whose own SQL comment states why it crosses users; product reads/writes
// stay user-scoped. ClaimDueJob claims the next due job across users (single worker queue);
// PurgeTerminalJobs is the queue owner's bounded global terminal-row maintenance scan.
// TwinkleLedgerDedupExists is deliberately partially global: payment transaction keys are
// unique across ALL users (an OR arm widens the row scan), so its user_id equality is not a
// conjunctive scope and the OR-taint rule below rightly refuses it.
const globalQueries = new Set([
  'memory/jobs.sql#ClaimDueJob',
  'memory/jobs.sql#PurgeTerminalJobs',
  'twinkle/ledger.sql#TwinkleLedgerDedupExists',
  // Admin console job-queue health (plan 58): global operator reads of the shared queue, like
  // ClaimDueJob/PurgeTerminalJobs — aggregate status counts, no per-user scope.
  'memory/admin_stats.sql#CountJobsByStatus',
  'memory/admin_stats.sql#CountDeadLetteredJobs',
])

// Blank SQL comments, single-quoted string literals, and dollar-quoted bodies in one
// left-to-right pass — whichever delimiter opens first wins. A '(' / ')' / ';' / '--'
// / '$$' inside a literal or comment would otherwise fool the table paren-scanner or
// the statement splitter (fail-open, or a false-positive). Structure outside literals
// (identifiers, parens, ';') is preserved so the scanners see only real SQL.
export function stripSqlNoise(source) {
  let out = ''
  let i = 0
  const n = source.length
  while (i < n) {
    const ch = source[i]
    if (ch === '-' && source[i + 1] === '-') {
      let j = i + 2
      while (j < n && source[j] !== '\n') j += 1
      i = j
      continue
    }
    if (ch === '/' && source[i + 1] === '*') {
      let j = i + 2
      while (j < n && !(source[j] === '*' && source[j + 1] === '/')) j += 1
      i = Math.min(n, j + 2)
      out += ' '
      continue
    }
    if (ch === "'") {
      let j = i + 1
      while (j < n) {
        if (source[j] === "'") {
          if (source[j + 1] === "'") {
            j += 2
            continue
          }
          j += 1
          break
        }
        j += 1
      }
      out += "''"
      i = j
      continue
    }
    if (ch === '$') {
      const tag = /^\$\w*\$/.exec(source.slice(i, i + 64))
      // A lone $n is a positional parameter, not a dollar-quote opener.
      if (tag && !/^\$\d+\$?$/.test(tag[0])) {
        const marker = tag[0]
        const close = source.indexOf(marker, i + marker.length)
        i = close === -1 ? n : close + marker.length
        out += ' '
        continue
      }
    }
    out += ch
    i += 1
  }
  return out
}

// Read each CREATE TABLE column body by balancing parentheses from the header's open
// paren (input must be noise-stripped first). Anchoring on `)\s*;` instead would let a
// table with trailing options (`) TABLESPACE fast;`, `INHERITS …`, `USING …`) slip past
// the user_id check, and a parenthesized column type (`numeric(10,2)`, `CHECK (…)`)
// would truncate the body. The header tolerates table modifiers (UNLOGGED/TEMP/…). An
// unbalanced body returns null so the caller flags it rather than silently skipping.
export function createTableBodies(source) {
  const header =
    /\bCREATE\s+(?:(?:GLOBAL|LOCAL|TEMP|TEMPORARY|UNLOGGED)\s+)*TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"[^"]+"|[a-zA-Z0-9_]+)\.)?(?:"([^"]+)"|([a-zA-Z0-9_]+))\s*\(/gi
  const tables = []
  let match
  while ((match = header.exec(source))) {
    match[1] = match[1] ?? match[2]
    const open = header.lastIndex - 1
    let depth = 0
    let end = -1
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === '(') depth += 1
      else if (source[i] === ')' && --depth === 0) {
        end = i
        break
      }
    }
    tables.push({ table: match[1], body: end === -1 ? null : source.slice(open + 1, end) })
  }
  return tables
}

const TABLE_CONSTRAINT_KEYWORDS = new Set([
  'CONSTRAINT',
  'PRIMARY',
  'UNIQUE',
  'FOREIGN',
  'CHECK',
  'EXCLUDE',
  'LIKE',
])

// The declared column names of a (noise-stripped, paren-balanced) CREATE TABLE body.
// Splitting on top-level commas separates column definitions from table constraints, so
// a user_id that appears only inside a REFERENCES target, a CHECK expression, or another
// column's name (`auditor_user_id`) is never mistaken for an owned column.
export function tableColumnNames(body) {
  const columns = []
  for (const item of splitTopLevel(body, ',')) {
    const first = /^\s*(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_$]*))/.exec(item)
    if (!first) continue
    const name = (first[1] ?? first[2]).toLowerCase()
    if (TABLE_CONSTRAINT_KEYWORDS.has(name.toUpperCase())) continue
    columns.push(name)
  }
  return columns
}

function splitTopLevel(text, separator) {
  const parts = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
    else if (ch === separator && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts
}

// ---------------------------------------------------------------------------
// Query-statement analysis: tokenize → group parens → walk each statement.
// ---------------------------------------------------------------------------

function tokenizeSql(sql) {
  const tokens = []
  let i = 0
  const n = sql.length
  while (i < n) {
    const ch = sql[i]
    if (/\s/.test(ch)) {
      i += 1
      continue
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1
      while (j < n && /[A-Za-z0-9_$]/.test(sql[j])) j += 1
      tokens.push({ t: 'ident', v: sql.slice(i, j) })
      i = j
      continue
    }
    if (ch === '"') {
      let j = i + 1
      while (j < n && sql[j] !== '"') j += 1
      tokens.push({ t: 'ident', v: sql.slice(i + 1, j) })
      i = j + 1
      continue
    }
    if (ch === "'") {
      // stripSqlNoise leaves only empty '' literals.
      let j = i + 1
      while (j < n && sql[j] !== "'") j += 1
      tokens.push({ t: 'literal', v: '' })
      i = j + 1
      continue
    }
    if (ch === '$' && /[0-9]/.test(sql[i + 1] ?? '')) {
      let j = i + 1
      while (j < n && /[0-9]/.test(sql[j])) j += 1
      tokens.push({ t: 'param', v: sql.slice(i, j) })
      i = j
      continue
    }
    if (/[0-9]/.test(ch)) {
      let j = i + 1
      while (j < n && /[0-9.eE]/.test(sql[j])) j += 1
      tokens.push({ t: 'number', v: sql.slice(i, j) })
      i = j
      continue
    }
    const two = sql.slice(i, i + 2)
    if (['::', '<>', '<=', '>=', '!=', '||'].includes(two)) {
      tokens.push({ t: 'punct', v: two })
      i += 2
      continue
    }
    tokens.push({ t: 'punct', v: ch })
    i += 1
  }
  return tokens
}

// Nest paren groups so statement analysis can use plain lookahead within one level.
// CASE … END nests like a paren group: its WHEN/OR internals are expression-bracketed
// by CASE/END rather than parentheses, and leaving them flat would let a CASE's OR
// taint the whole surrounding clause level.
function groupTokens(tokens) {
  const root = []
  const stack = [root]
  for (const token of tokens) {
    const word = token.t === 'ident' ? token.v.toUpperCase() : null
    if ((token.t === 'punct' && token.v === '(') || word === 'CASE') {
      const group = { t: 'group', children: word === 'CASE' ? [token] : [] }
      stack[stack.length - 1].push(group)
      stack.push(group.children)
    } else if ((token.t === 'punct' && token.v === ')') || word === 'END') {
      if (stack.length === 1) return null
      stack.pop()
    } else {
      stack[stack.length - 1].push(token)
    }
  }
  return stack.length === 1 ? root : null
}

const STATEMENT_KINDS = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH'])
const CLAUSE_KEYWORDS = new Set([
  'SELECT',
  'FROM',
  'WHERE',
  'ON',
  'HAVING',
  'SET',
  'VALUES',
  'RETURNING',
  'GROUP',
  'ORDER',
  'LIMIT',
  'WINDOW',
])
// Words that terminate an alias position (so `UPDATE jobs SET …` never reads SET as an alias).
const NON_ALIAS_KEYWORDS = new Set([
  'AS',
  'ON',
  'SET',
  'WHERE',
  'JOIN',
  'LEFT',
  'RIGHT',
  'FULL',
  'INNER',
  'OUTER',
  'CROSS',
  'USING',
  'GROUP',
  'ORDER',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'FOR',
  'RETURNING',
  'VALUES',
  'SELECT',
  'FROM',
  'AND',
  'OR',
  'NOT',
  'UNION',
  'EXCEPT',
  'INTERSECT',
  'WITH',
  'WINDOW',
  'FETCH',
  'DO',
  'NATURAL',
  'LATERAL',
  'TABLESAMPLE',
])

const upper = (node) => (node?.t === 'ident' ? node.v.toUpperCase() : null)

function isParamRef(children, index) {
  const node = children[index]
  if (!node) return false
  if (node.t === 'param') return true
  // sqlc.arg(name) / sqlc.narg(name): ident sqlc, '.', ident arg|narg, group
  if (upper(node) === 'SQLC') {
    const dot = children[index + 1]
    const fn = upper(children[index + 2])
    const args = children[index + 3]
    return dot?.v === '.' && (fn === 'ARG' || fn === 'NARG') && args?.t === 'group'
  }
  return false
}

// Read a user_id/parameter reference around an equality. Returns
// { node: 'PARAM' | 'q:<qualifier>' | 'BARE' } or null when the operand is not a
// user_id-shaped reference at all.
function readUserIdRef(children, index, direction) {
  if (direction === 'left') {
    const node = children[index]
    if (node?.t === 'ident' && node.v.toLowerCase() === 'user_id') {
      const dot = children[index - 1]
      const qual = children[index - 2]
      if (dot?.v === '.' && qual?.t === 'ident') return { node: `q:${qual.v.toLowerCase()}` }
      return { node: 'BARE' }
    }
    if (node?.t === 'param') return { node: 'PARAM' }
    // sqlc.arg(x) on the left reads backwards as [sqlc][.][arg|narg][group]
    if (node?.t === 'group') {
      const fn = upper(children[index - 1])
      if (
        (fn === 'ARG' || fn === 'NARG') &&
        children[index - 2]?.v === '.' &&
        upper(children[index - 3]) === 'SQLC'
      )
        return { node: 'PARAM' }
    }
    return null
  }
  if (isParamRef(children, index)) return { node: 'PARAM' }
  const node = children[index]
  if (node?.t === 'ident') {
    if (node.v.toLowerCase() === 'user_id') {
      // Bare user_id — unless it is a qualifier prefix (user_id never is; '.' follows quals only)
      return { node: 'BARE' }
    }
    const dot = children[index + 1]
    const col = children[index + 2]
    if (dot?.v === '.' && col?.t === 'ident' && col.v.toLowerCase() === 'user_id') {
      return { node: `q:${node.v.toLowerCase()}` }
    }
  }
  return null
}

function analyzeStatement(children, ctx) {
  const kind = upper(children[0])
  if (!kind || !STATEMENT_KINDS.has(kind)) {
    ctx.violation(`unsupported statement kind ${kind ?? '(unparsed)'} — fail-closed`)
    return
  }
  const scopeRoot = { relations: [], parent: null }
  walk(children, ctx, scopeRoot, { excluded: false, clause: null, tainted: false })

  // Every product relation must be user_id-connected to a parameter.
  const reachable = connectedToParam(ctx.edges)
  for (const conflict of ctx.pendingConflicts) {
    const target = conflict.target
    if (target && platformTables.has(target.table)) continue
    const guarded =
      target &&
      ctx.edges.some(
        ([a, b]) =>
          (a === `q:${target.key}` && b === 'q:excluded') ||
          (b === `q:${target.key}` && a === 'q:excluded'),
      )
    if (!guarded) {
      ctx.violation(
        `ON CONFLICT DO UPDATE on ${target ? target.table : '(unparsed)'} must pin user_id in the conflict target or guard with <table>.user_id = EXCLUDED.user_id`,
      )
    }
  }
  for (const rel of ctx.relations) {
    if (platformTables.has(rel.table)) continue
    if (ctx.cteNames.has(rel.table)) continue
    if (ctx.derivedAliases.has(rel.key)) continue
    if (rel.insertTarget) continue
    if (rel.table === 'excluded') continue
    if (!reachable.has(`q:${rel.key}`)) {
      ctx.violation(
        `relation "${rel.table}"${rel.key === rel.table ? '' : ` (alias ${rel.key})`} has no user_id predicate reaching a parameter`,
      )
    }
  }
}

function connectedToParam(edges) {
  const adjacency = new Map()
  const link = (a, b) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set())
    adjacency.get(a).add(b)
  }
  for (const [a, b] of edges) {
    link(a, b)
    link(b, a)
  }
  const seen = new Set(['PARAM'])
  const queue = ['PARAM']
  while (queue.length) {
    const node = queue.pop()
    for (const next of adjacency.get(node) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return seen
}

function registerRelation(ctx, scope, { table, alias, insertTarget = false }) {
  const key = (alias ?? table).toLowerCase()
  const existing = ctx.relations.find((r) => r.key === key)
  if (existing) {
    // Re-reading the same CTE is one definition referenced twice — safe to merge. Two
    // same-named real-table relations cannot be told apart in the equality graph, and
    // merging them could mark an unscoped instance as scoped (fail-open) — refuse those.
    if (existing.table === table.toLowerCase() && ctx.cteNames.has(existing.table)) {
      scope.relations.push(existing)
      return
    }
    ctx.violation(`duplicate relation name/alias "${key}" — qualify with distinct aliases`)
    return
  }
  if (ctx.derivedAliases.has(key)) {
    // A real relation sharing a derived-table alias would inherit its exemption (fail-open).
    ctx.violation(`duplicate relation name/alias "${key}" — qualify with distinct aliases`)
    return
  }
  const rel = { key, table: table.toLowerCase(), insertTarget }
  ctx.relations.push(rel)
  scope.relations.push(rel)
}

// Parse a relation after FROM/JOIN/UPDATE/USING/INTO starting at children[i].
// Returns the index after the relation (and its alias), or i when no relation parses.
function parseRelation(children, i, ctx, scope, { insertTarget = false } = {}) {
  let index = i
  while (upper(children[index]) === 'ONLY' || upper(children[index]) === 'LATERAL') index += 1
  const node = children[index]
  if (!node) return i
  if (node.t === 'group') {
    // Derived table: its alias is exempt from per-relation checks, but its body's own
    // relations are still walked and must connect (the alias only names the projection).
    walk(
      node.children,
      ctx,
      { relations: [], parent: scope },
      { excluded: false, clause: null, tainted: false },
    )
    let j = index + 1
    if (upper(children[j]) === 'AS') j += 1
    const alias = children[j]
    if (alias?.t === 'ident' && !NON_ALIAS_KEYWORDS.has(alias.v.toUpperCase())) {
      const key = alias.v.toLowerCase()
      if (ctx.derivedAliases.has(key) || ctx.relations.some((r) => r.key === key)) {
        ctx.violation(`duplicate relation name/alias "${key}" — qualify with distinct aliases`)
      }
      ctx.derivedAliases.add(key)
      return j + 1
    }
    ctx.violation('derived table (subquery in FROM) requires an alias — fail-closed')
    return index + 1
  }
  if (node.t !== 'ident' || NON_ALIAS_KEYWORDS.has(node.v.toUpperCase())) return i
  // schema-qualified name: take the last segment
  let table = node.v
  let j = index + 1
  while (children[j]?.v === '.' && children[j + 1]?.t === 'ident') {
    table = children[j + 1].v
    j += 2
  }
  // A function call in FROM (UNNEST(...), generate_series(...)) is not a plain relation.
  if (children[j]?.t === 'group' && !insertTarget) {
    ctx.violation(`set-returning function "${table}" in FROM is unsupported — fail-closed`)
    return j + 1
  }
  let alias = null
  let k = j
  if (upper(children[k]) === 'AS') k += 1
  const aliasNode = children[k]
  if (
    aliasNode?.t === 'ident' &&
    !NON_ALIAS_KEYWORDS.has(aliasNode.v.toUpperCase()) &&
    !(children[k + 1]?.v === '.') // qualified ref, not an alias
  ) {
    alias = aliasNode.v
    k += 1
  } else {
    k = j
  }
  registerRelation(ctx, scope, { table, alias, insertTarget })
  return k
}

// Insert handling: `user_id` must be one of the inserted columns and its inserted value
// must be a parameter or a user_id column reference (whose source relation the equality
// graph checks separately). Positional matching runs per VALUES tuple and per top-level
// SELECT output column.
function checkInsert(children, i, ctx, scope) {
  let index = parseRelation(children, i, ctx, scope, { insertTarget: true })
  const target = ctx.relations[ctx.relations.length - 1]
  const targetLabel = target ? target.table : '(unparsed)'
  ctx.lastInsertTarget = target?.insertTarget ? target : null
  if (platformTables.has(target?.table)) return
  const columnsGroup = children[index]
  if (columnsGroup?.t !== 'group') {
    ctx.violation(`INSERT into ${targetLabel} must list its columns explicitly — fail-closed`)
    return
  }
  const columns = splitGroupTopLevel(columnsGroup.children).map((item) =>
    item[0]?.t === 'ident' ? item[0].v.toLowerCase() : '',
  )
  const userIdIndex = columns.indexOf('user_id')
  if (userIdIndex === -1) {
    ctx.violation(`INSERT into ${targetLabel} does not set user_id`)
    return
  }
  index += 1
  const sourceKind = upper(children[index])
  if (sourceKind === 'VALUES') {
    let j = index + 1
    while (children[j]?.t === 'group') {
      const exprs = splitGroupTopLevel(children[j].children)
      const expr = exprs[userIdIndex] ?? []
      if (!isParamExpr(expr) && !isUserIdColumnExpr(expr)) {
        ctx.violation(`INSERT into ${targetLabel}: the user_id value must be a parameter`)
      }
      j += 1
      if (children[j]?.v === ',') j += 1
      else break
    }
    return
  }
  if (sourceKind === 'SELECT') {
    const selectList = []
    let j = index + 1
    while (j < children.length && !(upper(children[j]) === 'FROM')) {
      selectList.push(children[j])
      j += 1
    }
    const exprs = splitGroupTopLevel(selectList)
    const expr = exprs[userIdIndex] ?? []
    if (!isParamExpr(expr) && !isUserIdColumnExpr(expr)) {
      ctx.violation(
        `INSERT into ${targetLabel}: the user_id output of the source SELECT must be a parameter or a user_id column`,
      )
    }
    return
  }
  ctx.violation(`INSERT into ${targetLabel} has an unsupported source (${sourceKind ?? 'none'})`)
}

function splitGroupTopLevel(children) {
  const parts = [[]]
  for (const node of children) {
    if (node.t === 'punct' && node.v === ',') parts.push([])
    else parts[parts.length - 1].push(node)
  }
  return parts
}

function isParamExpr(expr) {
  if (!expr.length) return false
  if (expr[0].t === 'param') return true
  return isParamRef(expr, 0)
}

function isUserIdColumnExpr(expr) {
  const idents = expr.filter((node) => node.t === 'ident' || node.v === '.')
  if (!idents.length) return false
  const last = idents[idents.length - 1]
  return last.t === 'ident' && last.v.toLowerCase() === 'user_id'
}

function walk(children, ctx, scope, { excluded, clause, tainted }) {
  // An equality that sits under an OR (or a NOT) is one disjunct, not a conjunctive
  // scope: `user_id = $1 OR reason = 'payment'` still reads other users' rows. Taint the
  // level and everything below it — except a nested sub-SELECT, which scopes its own
  // row reads and therefore starts clean.
  const level = tainted || children.some((node) => upper(node) === 'OR')
  let cteMode = false
  let index = 0
  while (index < children.length) {
    const node = children[index]
    const word = upper(node)

    if (node.t === 'group') {
      const prevWord = upper(children[index - 1])
      // FILTER (WHERE …) restricts an aggregate, not the row set — its equalities must
      // not scope-connect a relation.
      const childExcluded = excluded || prevWord === 'FILTER'
      const startsSubquery = STATEMENT_KINDS.has(upper(node.children[0]))
      walk(
        node.children,
        ctx,
        { relations: [], parent: scope },
        {
          excluded: childExcluded,
          clause: startsSubquery ? null : clause,
          tainted: startsSubquery ? false : level || prevWord === 'NOT',
        },
      )
      index += 1
      continue
    }

    if (word === 'WITH' && clause === null) {
      cteMode = true
      index += 1
      continue
    }
    if (cteMode && node.t === 'ident' && !STATEMENT_KINDS.has(word)) {
      // name [ (columns) ] AS [NOT] [MATERIALIZED] ( body )
      let j = index + 1
      if (children[j]?.t === 'group') j += 1
      if (upper(children[j]) === 'AS') {
        ctx.cteNames.add(node.v.toLowerCase())
        j += 1
        while (upper(children[j]) === 'NOT' || upper(children[j]) === 'MATERIALIZED') j += 1
        if (children[j]?.t === 'group') {
          walk(
            children[j].children,
            ctx,
            { relations: [], parent: scope },
            { excluded, clause: null, tainted: false },
          )
          j += 1
        }
        if (children[j]?.v === ',') {
          index = j + 1
          continue
        }
        cteMode = false
        index = j
        continue
      }
    }
    if (cteMode && STATEMENT_KINDS.has(word)) cteMode = false

    if (word && CLAUSE_KEYWORDS.has(word)) clause = word

    if (word === 'INSERT' && upper(children[index + 1]) === 'INTO') {
      checkInsert(children, index + 2, ctx, scope)
      // fall through: VALUES/SELECT/ON CONFLICT tokens after INTO are still walked for
      // relations and predicates by the main loop.
      index += 2
      continue
    }

    // ON CONFLICT ... DO UPDATE mutates a pre-existing row the insert's own user_id value
    // does not protect: the conflict target must pin user_id, or the DO UPDATE must carry
    // a `target.user_id = EXCLUDED.user_id` guard (checked as an edge after the walk).
    if (word === 'CONFLICT' && upper(children[index - 1]) === 'ON') {
      let j = index + 1
      const columns = []
      if (children[j]?.t === 'group') {
        for (const inner of children[j].children) {
          if (inner.t === 'ident') columns.push(inner.v.toLowerCase())
        }
        j += 1
        if (upper(children[j]) === 'WHERE') {
          // partial-index predicate: skip to DO at this level
          while (j < children.length && upper(children[j]) !== 'DO') j += 1
        }
      } else if (upper(children[j]) === 'ON' && upper(children[j + 1]) === 'CONSTRAINT') {
        ctx.violation('ON CONFLICT ON CONSTRAINT is unsupported — name the columns instead')
      }
      while (j < children.length && upper(children[j]) !== 'DO') j += 1
      if (upper(children[j + 1]) === 'UPDATE' && !columns.includes('user_id')) {
        ctx.pendingConflicts.push({ target: ctx.lastInsertTarget })
      }
      index = j + 1
      continue
    }

    if (
      (word === 'FROM' && upper(children[index - 1]) !== 'DISTINCT') ||
      word === 'JOIN' ||
      (word === 'USING' && children[index + 1]?.t !== 'group') ||
      (word === 'UPDATE' &&
        upper(children[index - 1]) !== 'FOR' &&
        upper(children[index - 1]) !== 'DO')
    ) {
      let next = parseRelation(children, index + 1, ctx, scope)
      // comma-separated FROM/USING list
      while (next > index && children[next]?.v === ',') {
        const after = parseRelation(children, next + 1, ctx, scope)
        if (after === next + 1) break
        next = after
      }
      index = next > index ? next : index + 1
      continue
    }

    if (!excluded && !level && node.t === 'punct' && node.v === '=') {
      if (clause === 'WHERE' || clause === 'ON' || clause === 'HAVING') {
        const left = readUserIdRef(children, index - 1, 'left')
        const right = readUserIdRef(children, index + 1, 'right')
        if (left && right && !negatedEquality(children, index)) {
          const a = resolveNode(left.node, scope, ctx)
          const b = resolveNode(right.node, scope, ctx)
          if (a && b) ctx.edges.push([a, b])
        }
      }
    }

    index += 1
  }
}

// `NOT a.user_id = $1` parses as NOT(a.user_id = $1): the equality selects the OTHER
// users' rows, so a NOT directly before the left operand disqualifies the edge.
function negatedEquality(children, equalsIndex) {
  let leftStart = equalsIndex - 1
  const leftNode = children[leftStart]
  if (leftNode?.t === 'ident' && children[equalsIndex - 2]?.v === '.') {
    leftStart = equalsIndex - 3
  } else if (leftNode?.t === 'group') {
    leftStart = equalsIndex - 4 // sqlc . arg (group)
  }
  return upper(children[leftStart - 1]) === 'NOT'
}

// BARE user_id resolves against the nearest enclosing scope that introduced relations;
// with more than one relation in that scope the reference is ambiguous (PostgreSQL
// would reject it too) — fail closed rather than guess.
function resolveNode(node, scope, ctx) {
  if (node !== 'BARE') return node
  let current = scope
  while (current && current.relations.length === 0) current = current.parent
  if (!current) {
    ctx.violation('unqualified user_id with no relation in scope — fail-closed')
    return null
  }
  if (current.relations.length > 1) {
    ctx.violation('unqualified user_id is ambiguous across multiple relations — qualify it')
    return null
  }
  return `q:${current.relations[0].key}`
}

// Split a query file into sqlc-named segments so violations carry the query name and
// the global allowlist can address one statement precisely.
export function segmentSqlcQueries(rawSource) {
  const marker = /^[ \t]*--[ \t]*name:[ \t]*([A-Za-z0-9_]+)/gm
  const segments = []
  let previous = { name: null, start: 0 }
  let match
  while ((match = marker.exec(rawSource))) {
    segments.push({ ...previous, end: match.index })
    previous = { name: match[1], start: match.index }
  }
  segments.push({ ...previous, end: rawSource.length })
  return segments
    .map(({ name, start, end }) => ({ name, sql: rawSource.slice(start, end) }))
    .filter(({ sql }) => stripSqlNoise(sql).trim().length > 0)
}

export function findPersistenceViolations({ migrationsRoot, queriesRoot }) {
  const violations = []

  for (const file of sqlFiles(migrationsRoot)) {
    const rel = relative(repoRoot, file).replaceAll('\\', '/')
    const source = stripSqlNoise(readFileSync(file, 'utf8'))
    for (const { table, body } of createTableBodies(source)) {
      if (platformTables.has(table)) continue
      if (body === null) {
        violations.push(
          `${rel}: product table ${table} could not be parsed; ensure balanced parentheses and a user_id column`,
        )
      } else if (!tableColumnNames(body).includes('user_id')) {
        violations.push(
          `${rel}: product table ${table} must declare an owned user_id column (a reference, expression, or *_user_id column does not count) or be listed as platform-owned`,
        )
      }
    }
  }

  for (const file of sqlFiles(queriesRoot)) {
    const rel = relative(queriesRoot, file).replaceAll('\\', '/')
    const [owner] = rel.split('/')
    if (platformQueryDirs.has(owner)) continue
    const raw = readFileSync(file, 'utf8')
    for (const { name, sql } of segmentSqlcQueries(raw)) {
      const label = `apps/api/db/queries/${rel}#${name ?? 'unnamed'}`
      if (name && globalQueries.has(`${rel}#${name}`)) continue
      const stripped = stripSqlNoise(sql)
      for (const statementSql of stripped.split(';')) {
        if (!statementSql.trim()) continue
        const grouped = groupTokens(tokenizeSql(statementSql))
        const ctx = {
          relations: [],
          edges: [],
          cteNames: new Set(),
          derivedAliases: new Set(),
          pendingConflicts: [],
          lastInsertTarget: null,
          violation: (message) => violations.push(`${label}: ${message}`),
        }
        if (grouped === null) {
          ctx.violation('unbalanced parentheses — fail-closed')
          continue
        }
        analyzeStatement(grouped, ctx)
      }
    }
  }

  return violations
}

function sqlFiles(root) {
  if (!existsSync(root)) return []
  const files = []
  walkSqlFiles(root, files)
  return files
}

function walkSqlFiles(dir, files) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkSqlFiles(path, files)
    } else if (entry.isFile() && entry.name.endsWith('.sql')) {
      files.push(path)
    }
  }
}

function isDirectRun() {
  return (
    process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  )
}

if (isDirectRun()) {
  section('persistence isolation')
  const violations = findPersistenceViolations({
    migrationsRoot: join(repoRoot, 'apps/api/db/migrations'),
    queriesRoot: join(repoRoot, 'apps/api/db/queries'),
  })
  if (violations.length) {
    console.error(violations.join('\n'))
    fail('persistence isolation guard failed')
  }
  ok('product migrations/queries are user-scoped or explicitly platform-owned')
}
