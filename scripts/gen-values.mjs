#!/usr/bin/env node
// Generate FE (TypeScript) + BE (Go) constants from spec/values.yaml — the single canonical
// source of tuning numbers ("balance patch" file). Run via `pnpm gen:values` (or `pnpm gen`).
// Outputs (both committed, both marked GENERATED — DO NOT EDIT):
//   frontend/src/shared/config/values.gen.ts
//   backend/internal/values/values_gen.go
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { parse } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcPath = join(root, 'spec', 'values.yaml')
const tsOut = join(root, 'frontend', 'src', 'shared', 'config', 'values.gen.ts')
const goOut = join(root, 'backend', 'internal', 'values', 'values_gen.go')

const camel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
const pascal = (s) => s.replace(/(^|_)([a-z0-9])/g, (_, __, c) => c.toUpperCase())
const num = (v) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`values.yaml: only finite numbers are supported (got ${JSON.stringify(v)})`)
  }
  return String(v)
}

const doc = parse(readFileSync(srcPath, 'utf8'))
const groups = Object.entries(doc)
if (!groups.length) throw new Error('values.yaml has no groups')

// ── TypeScript: nested `VALUES` (camelCase) ──────────────────────────────────────────
const tsGroups = groups
  .map(([g, kv]) => {
    const lines = Object.entries(kv).map(([k, v]) => `    ${camel(k)}: ${num(v)},`)
    return `  ${camel(g)}: {\n${lines.join('\n')}\n  },`
  })
  .join('\n')
const ts = `/* GENERATED FROM spec/values.yaml — DO NOT EDIT. Run \`pnpm gen:values\`. */
export const VALUES = {
${tsGroups}
} as const
`

// ── Go: package `values`, one untyped const block per group (drop-in like a literal) ──
const goBlocks = groups
  .map(([g, kv]) => {
    const entries = Object.entries(kv).map(([k, v]) => ({ name: pascal(g) + pascal(k), val: num(v) }))
    const w = Math.max(...entries.map((e) => e.name.length))
    const lines = entries.map((e) => `\t${e.name.padEnd(w)} = ${e.val}`)
    return `// ${g}\nconst (\n${lines.join('\n')}\n)`
  })
  .join('\n\n')
const go = `// Code generated from spec/values.yaml — DO NOT EDIT. Run \`pnpm gen:values\`.
//
// Canonical tuning values ("balance patch"). Edit spec/values.yaml, then run \`pnpm gen:values\`.
// Consts are untyped so they drop into float32/float64/int contexts exactly like a literal.
package values

${goBlocks}
`

mkdirSync(dirname(tsOut), { recursive: true })
mkdirSync(dirname(goOut), { recursive: true })
writeFileSync(tsOut, ts, 'utf8')
writeFileSync(goOut, go, 'utf8')
console.log(`Generated from spec/values.yaml:\n  ${tsOut}\n  ${goOut}`)
