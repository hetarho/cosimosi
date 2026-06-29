import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

import { createTableBodies, findPersistenceViolations, stripSqlNoise } from './check-persistence-isolation.mjs'

test('stripSqlNoise blanks parens/semicolons/comments/dollar-quotes inside literals', () => {
  const out = stripSqlNoise("SELECT 1 WHERE note = 'a ) ; -- $$ b' -- trailing ; (\nAND user_id = $1;")
  assert.doesNotMatch(out, /\) ; -- /) // string contents are gone
  assert.equal(out.split(';').filter((s) => s.trim()).length, 1) // only the real terminator splits
  assert.match(out, /user_id/) // real predicate survives
})

test('createTableBodies survives trailing options + table modifiers, and flags unbalanced bodies', () => {
  assert.equal(createTableBodies('CREATE TABLE leaks ( id uuid ) TABLESPACE fast;')[0].table, 'leaks')
  assert.equal(createTableBodies('CREATE UNLOGGED TABLE u ( id uuid );')[0].table, 'u')
  assert.equal(createTableBodies('CREATE TABLE broken ( id uuid')[0].body, null)
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

test('flags an unscoped product table even with a paren inside a string default (no fail-open)', (t) => {
  const roots = withSql(t, { 'migrations/0001.sql': "CREATE TABLE leaks ( id uuid, note text DEFAULT 'open ( paren' );" })
  const violations = findPersistenceViolations(roots)
  assert.equal(violations.length, 1)
  assert.match(violations[0], /leaks must declare user_id/)
})

test('passes a user-scoped table with a paren inside a string default (no false-positive)', (t) => {
  const roots = withSql(t, {
    'migrations/0001.sql': "CREATE TABLE records ( id uuid, note text DEFAULT 'close ) paren', user_id text NOT NULL );",
  })
  assert.deepEqual(findPersistenceViolations(roots), [])
})

test('skips platform queries, flags unscoped product queries, and does not shatter dollar-quoted bodies', (t) => {
  const roots = withSql(t, {
    'queries/platform/probe.sql': 'SELECT 1;',
    'queries/records/get.sql': '-- name: GetRecord :one\nSELECT * FROM records WHERE user_id = $1;',
    'queries/records/leak.sql': 'SELECT * FROM records;',
  })
  const violations = findPersistenceViolations(roots)
  assert.equal(violations.length, 1)
  assert.match(violations[0], /records\/leak\.sql: product query must include a user_id/)
})
