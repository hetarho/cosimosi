import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

import {
  createTableBodies,
  findPersistenceViolations,
  segmentSqlcQueries,
  stripSqlNoise,
  tableColumnNames,
} from './check-persistence-isolation.mjs'
import { repoRoot } from './lib.mjs'

test('stripSqlNoise blanks parens/semicolons/comments/dollar-quotes inside literals', () => {
  const out = stripSqlNoise(
    "SELECT 1 WHERE note = 'a ) ; -- $$ b' -- trailing ; (\nAND user_id = $1;",
  )
  assert.doesNotMatch(out, /\) ; -- /) // string contents are gone
  assert.equal(out.split(';').filter((s) => s.trim()).length, 1) // only the real terminator splits
  assert.match(out, /user_id/) // real predicate survives
})

test('stripSqlNoise keeps positional parameters (a $1 is not a dollar-quote opener)', () => {
  assert.match(stripSqlNoise('SELECT 1 WHERE user_id = $1 AND kind = $2;'), /\$1[\s\S]*\$2/)
})

test('createTableBodies survives trailing options + table modifiers, and flags unbalanced bodies', () => {
  assert.equal(
    createTableBodies('CREATE TABLE leaks ( id uuid ) TABLESPACE fast;')[0].table,
    'leaks',
  )
  assert.equal(createTableBodies('CREATE UNLOGGED TABLE u ( id uuid );')[0].table, 'u')
  assert.equal(createTableBodies('CREATE TABLE broken ( id uuid')[0].body, null)
})

test('tableColumnNames reads declared columns only — not references, constraints, or lookalikes', () => {
  const body = `
    id uuid PRIMARY KEY,
    owner_id uuid REFERENCES users(user_id),
    auditor_user_id uuid,
    note text DEFAULT '',
    CONSTRAINT one UNIQUE (owner_id),
    CHECK (auditor_user_id IS NOT NULL)
  `
  assert.deepEqual(tableColumnNames(body), ['id', 'owner_id', 'auditor_user_id', 'note'])
})

test('segmentSqlcQueries splits on -- name: markers and keeps the names', () => {
  const segments = segmentSqlcQueries(
    '-- header comment\n-- name: One :one\nSELECT 1;\n-- name: Two :exec\nSELECT 2;',
  )
  assert.deepEqual(
    segments.map((s) => s.name),
    ['One', 'Two'],
  )
})

function withSql(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'cosimosi-pers-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content, 'utf8')
  }
  return { migrationsRoot: join(root, 'migrations'), queriesRoot: join(root, 'queries') }
}

function queryViolations(t, sql) {
  return findPersistenceViolations(withSql(t, { 'queries/records/q.sql': sql }))
}

// ---------------------------------------------------------------------------
// Migrations: an owned user_id COLUMN is required — mentions do not count.
// ---------------------------------------------------------------------------

test('flags an unscoped product table even with a paren inside a string default (no fail-open)', (t) => {
  const roots = withSql(t, {
    'migrations/0001.sql': "CREATE TABLE leaks ( id uuid, note text DEFAULT 'open ( paren' );",
  })
  const violations = findPersistenceViolations(roots)
  assert.equal(violations.length, 1)
  assert.match(violations[0], /leaks must declare an owned user_id column/)
})

test('flags a table whose only user_id is a foreign-key reference target', (t) => {
  const roots = withSql(t, {
    'migrations/0001.sql':
      'CREATE TABLE leaks ( id uuid PRIMARY KEY, owner_id uuid REFERENCES users(user_id), body text );',
  })
  assert.match(findPersistenceViolations(roots)[0], /leaks must declare an owned user_id column/)
})

test('flags a table whose only user_id is inside another column name or a CHECK expression', (t) => {
  const roots = withSql(t, {
    'migrations/0001.sql': 'CREATE TABLE leaks ( id uuid, auditor_user_id uuid, body text );',
    'migrations/0002.sql':
      'CREATE TABLE leaks_two ( id uuid, body text, CHECK (length(body) > 0 OR user_id IS NULL) );',
  })
  const violations = findPersistenceViolations(roots)
  assert.equal(violations.length, 2)
})

test('passes a user-scoped table with a paren inside a string default (no false-positive)', (t) => {
  const roots = withSql(t, {
    'migrations/0001.sql':
      "CREATE TABLE records ( id uuid, note text DEFAULT 'close ) paren', user_id text NOT NULL );",
  })
  assert.deepEqual(findPersistenceViolations(roots), [])
})

// ---------------------------------------------------------------------------
// Queries: every product relation must reach a parameter through user_id equality.
// ---------------------------------------------------------------------------

test('skips platform queries, flags unscoped product queries, and does not shatter dollar-quoted bodies', (t) => {
  const roots = withSql(t, {
    'queries/platform/probe.sql': 'SELECT 1;',
    'queries/records/get.sql': '-- name: GetRecord :one\nSELECT * FROM records WHERE user_id = $1;',
    'queries/records/leak.sql': '-- name: Leak :many\nSELECT * FROM records;',
  })
  const violations = findPersistenceViolations(roots)
  assert.equal(violations.length, 1)
  assert.match(violations[0], /records\/leak\.sql#Leak: relation "records"/)
})

test('flags a projection-only user_id (selected but never a predicate)', (t) => {
  const violations = queryViolations(
    t,
    '-- name: LeakProjection :many\nSELECT user_id, body FROM records;',
  )
  assert.equal(violations.length, 1)
  assert.match(violations[0], /#LeakProjection: relation "records"/)
})

test('flags a join whose user_id predicate binds only the other table', (t) => {
  const violations = queryViolations(
    t,
    '-- name: LeakJoin :many\nSELECT r.body FROM records AS r JOIN sessions AS s ON s.user_id = sqlc.arg(user_id);',
  )
  assert.equal(violations.length, 1)
  assert.match(violations[0], /relation "records" \(alias r\)/)
})

test('flags a CTE that mentions user_id while the outer read is unscoped', (t) => {
  const violations = queryViolations(
    t,
    '-- name: LeakCte :many\nWITH me AS (SELECT user_id FROM accounts WHERE user_id = $1)\nSELECT body FROM records;',
  )
  assert.equal(violations.length, 1)
  assert.match(violations[0], /relation "records"/)
})

test('flags UPDATE whose only user_id is the SET assignment, and DELETE scoped via another table', (t) => {
  const update = queryViolations(
    t,
    '-- name: LeakUpdate :exec\nUPDATE records SET user_id = $1 WHERE id = $2;',
  )
  assert.match(update[0], /#LeakUpdate: relation "records"/)
  const del = queryViolations(
    t,
    '-- name: LeakDelete :exec\nDELETE FROM records WHERE id IN (SELECT record_id FROM sessions WHERE user_id = $1);',
  )
  assert.match(del[0], /#LeakDelete: relation "records"/)
})

test('flags INSERT that omits user_id, sources it unscoped, or hides the column list', (t) => {
  const missing = queryViolations(
    t,
    '-- name: NoUserId :exec\nINSERT INTO records (id, body) VALUES ($1, $2);',
  )
  assert.match(missing[0], /INSERT into records does not set user_id/)
  const unscopedSource = queryViolations(
    t,
    '-- name: LeakInsert :exec\nINSERT INTO records (id, user_id, body) SELECT id, $1, body FROM other_records;',
  )
  assert.match(unscopedSource[0], /relation "other_records"/)
  const noColumns = queryViolations(t, '-- name: NoCols :exec\nINSERT INTO records VALUES ($1);')
  assert.match(noColumns[0], /must list its columns explicitly/)
})

test('a quoted non-word table name is still parsed and checked', (t) => {
  const roots = withSql(t, {
    'migrations/0001.sql': 'CREATE TABLE "audit-log" ( id uuid, body text );',
  })
  assert.match(findPersistenceViolations(roots)[0], /audit-log must declare an owned user_id/)
})

test('a NOT-negated user_id equality is not a scope (fails closed)', (t) => {
  const violations = queryViolations(
    t,
    '-- name: NotLeak :many\nSELECT body FROM records WHERE NOT records.user_id = $1;',
  )
  assert.equal(violations.length, 1)
  assert.match(violations[0], /relation "records"/)
})

test('ON CONFLICT DO UPDATE must pin user_id in the target or guard via EXCLUDED', (t) => {
  const unguarded = queryViolations(
    t,
    '-- name: BadUpsert :exec\nINSERT INTO records (id, user_id, body) VALUES ($1, $2, $3)\nON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body;',
  )
  assert.equal(unguarded.length, 1)
  assert.match(unguarded[0], /ON CONFLICT DO UPDATE on records must pin user_id/)
  const pinned = queryViolations(
    t,
    '-- name: GoodUpsert :exec\nINSERT INTO records (id, user_id, body) VALUES ($1, $2, $3)\nON CONFLICT (user_id, id) DO UPDATE SET body = EXCLUDED.body;',
  )
  assert.deepEqual(pinned, [])
})

test('a derived table body is walked (unscoped inner read fails) and its alias cannot shadow', (t) => {
  const inner = queryViolations(
    t,
    '-- name: DerivedLeak :one\nSELECT d.c FROM (SELECT count(1) AS c FROM records) AS d;',
  )
  assert.equal(inner.length, 1)
  assert.match(inner[0], /relation "records"/)
  const shadow = queryViolations(
    t,
    '-- name: Shadow :one\nSELECT 1 FROM (SELECT 1) AS r WHERE EXISTS (SELECT 1 FROM records AS r WHERE r.user_id = $1);',
  )
  assert.equal(shadow.length, 1)
  assert.match(shadow[0], /duplicate relation name\/alias "r"/)
  const scopedInner = queryViolations(
    t,
    '-- name: DerivedOk :one\nSELECT d.c FROM (SELECT count(1) AS c FROM records WHERE user_id = $1) AS d;',
  )
  assert.deepEqual(scopedInner, [])
})

test('an OR disjunct is not a conjunctive scope (fails closed)', (t) => {
  const violations = queryViolations(
    t,
    "-- name: OrLeak :one\nSELECT body FROM records WHERE user_id = $1 OR kind = 'shared';",
  )
  assert.equal(violations.length, 1)
  assert.match(violations[0], /relation "records"/)
})

test('unsupported statement kinds, ambiguous bare user_id, and duplicate aliases fail closed', (t) => {
  assert.match(
    queryViolations(t, '-- name: Trunc :exec\nTRUNCATE records;')[0],
    /unsupported statement kind TRUNCATE/,
  )
  assert.match(
    queryViolations(
      t,
      '-- name: Ambiguous :many\nSELECT 1 FROM records, sessions WHERE user_id = $1;',
    )[0],
    /unqualified user_id is ambiguous/,
  )
  assert.match(
    queryViolations(
      t,
      '-- name: Dup :many\nSELECT 1 FROM records WHERE records.user_id = $1 AND EXISTS (SELECT 1 FROM records WHERE records.user_id = $1);',
    )[0],
    /duplicate relation name\/alias "records"/,
  )
})

test('flags only the unscoped statement of a multi-statement file, with its query name', (t) => {
  const violations = queryViolations(
    t,
    '-- name: Scoped :one\nSELECT body FROM records WHERE user_id = sqlc.arg(user_id);\n' +
      '-- name: Unscoped :many\nSELECT body FROM records;',
  )
  assert.equal(violations.length, 1)
  assert.match(violations[0], /#Unscoped:/)
})

// Positive controls: every supported scoped form passes.

test('passes transitive alias links, scoped CTE reuse, and bare user_id on a single relation', (t) => {
  const roots = withSql(t, {
    'queries/records/ok.sql': [
      '-- name: Transitive :many',
      'SELECT r.body FROM records AS r JOIN sessions AS s ON s.user_id = r.user_id WHERE s.user_id = sqlc.arg(user_id);',
      '-- name: CteReuse :many',
      'WITH mine AS (SELECT id, user_id FROM records WHERE user_id = sqlc.arg(user_id))',
      'SELECT a.id FROM mine AS a JOIN sessions AS s ON s.user_id = sqlc.arg(user_id) WHERE EXISTS (SELECT 1 FROM mine);',
      '-- name: Bare :one',
      'SELECT body FROM records WHERE user_id = sqlc.arg(user_id) FOR UPDATE;',
    ].join('\n'),
  })
  assert.deepEqual(findPersistenceViolations(roots), [])
})

test('passes scoped INSERT forms: VALUES parameter, scoped SELECT source, ON CONFLICT arm', (t) => {
  const roots = withSql(t, {
    'queries/records/ok.sql': [
      '-- name: InsertValues :exec',
      "INSERT INTO records (id, user_id, body) VALUES (sqlc.arg(id), sqlc.arg(user_id), '');",
      '-- name: InsertSelect :exec',
      'INSERT INTO records (id, user_id, body) SELECT s.id, s.user_id, s.body FROM staged AS s WHERE s.user_id = sqlc.arg(user_id);',
      '-- name: Upsert :exec',
      'INSERT INTO records (id, user_id, body) VALUES ($1, $2, $3)',
      'ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body WHERE records.user_id = EXCLUDED.user_id;',
    ].join('\n'),
  })
  assert.deepEqual(findPersistenceViolations(roots), [])
})

test('passes scoped UPDATE ... FROM and DELETE with an owned predicate', (t) => {
  const roots = withSql(t, {
    'queries/records/ok.sql': [
      '-- name: UpdateFrom :exec',
      'UPDATE records AS r SET body = d.body FROM drafts AS d WHERE d.user_id = sqlc.arg(user_id) AND r.user_id = d.user_id AND r.id = d.record_id;',
      '-- name: DeleteOwned :exec',
      'DELETE FROM records WHERE user_id = sqlc.arg(user_id) AND id = ANY(sqlc.arg(ids)::text[]);',
    ].join('\n'),
  })
  assert.deepEqual(findPersistenceViolations(roots), [])
})

// The strengthened checker must hold on the real corpus: every live migration and query
// is either genuinely user-scoped or explicitly allowlisted as a platform/global scan.
test('the real repository corpus passes the strengthened checker', () => {
  const violations = findPersistenceViolations({
    migrationsRoot: join(repoRoot, 'apps/api/db/migrations'),
    queriesRoot: join(repoRoot, 'apps/api/db/queries'),
  })
  assert.deepEqual(violations, [])
})
