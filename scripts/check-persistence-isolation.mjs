#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fail, ok, repoRoot, section } from './lib.mjs'

const platformQueryDirs = new Set(['platform'])
const platformTables = new Set([])

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
      if (tag) {
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
    /\bCREATE\s+(?:(?:GLOBAL|LOCAL|TEMP|TEMPORARY|UNLOGGED)\s+)*TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?[a-zA-Z0-9_]+"?\.)?"?([a-zA-Z0-9_]+)"?\s*\(/gi
  const tables = []
  let match
  while ((match = header.exec(source))) {
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
      } else if (!/\buser_id\b/i.test(body)) {
        violations.push(
          `${rel}: product table ${table} must declare user_id or be listed as platform-owned`,
        )
      }
    }
  }

  for (const file of sqlFiles(queriesRoot)) {
    const rel = relative(queriesRoot, file).replaceAll('\\', '/')
    const [owner] = rel.split('/')
    if (platformQueryDirs.has(owner)) continue
    const source = stripSqlNoise(readFileSync(file, 'utf8'))
    for (const statement of source.split(';')) {
      if (!statement.trim()) continue
      if (!/\buser_id\b/i.test(statement)) {
        violations.push(
          `apps/api/db/queries/${rel}: product query must include a user_id predicate`,
        )
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
