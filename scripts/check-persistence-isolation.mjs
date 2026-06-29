#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fail, ok, repoRoot, section } from './lib.mjs'

const migrationsRoot = join(repoRoot, 'apps/api/db/migrations')
const queriesRoot = join(repoRoot, 'apps/api/db/queries')
const platformQueryDirs = new Set(['platform'])
const platformTables = new Set([])
const violations = []

section('persistence isolation')

for (const file of sqlFiles(migrationsRoot)) {
  const rel = relative(repoRoot, file).replaceAll('\\', '/')
  const source = stripSqlComments(readFileSync(file, 'utf8'))
  for (const match of source.matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?([a-zA-Z0-9_]+)"?\.)?"?([a-zA-Z0-9_]+)"?\s*\(([\s\S]*?)\)\s*;/gi)) {
    const table = match[2]
    const body = match[3]
    if (platformTables.has(table)) continue
    if (!/\buser_id\b/i.test(body)) {
      violations.push(`${rel}: product table ${table} must declare user_id or be listed as platform-owned`)
    }
  }
}

for (const file of sqlFiles(queriesRoot)) {
  const rel = relative(queriesRoot, file).replaceAll('\\', '/')
  const [owner] = rel.split('/')
  if (platformQueryDirs.has(owner)) continue
  const source = stripSqlComments(readFileSync(file, 'utf8'))
  for (const statement of source.split(';')) {
    if (!statement.trim()) continue
    if (!/\buser_id\b/i.test(statement)) {
      violations.push(`apps/api/db/queries/${rel}: product query must include a user_id predicate`)
    }
  }
}

if (violations.length) {
  console.error(violations.join('\n'))
  fail('persistence isolation guard failed')
}

ok('product migrations/queries are user-scoped or explicitly platform-owned')

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

function stripSqlComments(source) {
  return source.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
}
