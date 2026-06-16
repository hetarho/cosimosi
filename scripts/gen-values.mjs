#!/usr/bin/env node
// Generate FE (TypeScript) + BE (Go) constants from spec/values.yaml — the single canonical
// source of tuning numbers ("balance patch" file). Run via `pnpm gen:values` (or `pnpm gen`).
// Outputs (both committed, both marked GENERATED — DO NOT EDIT):
//   frontend/src/shared/config/values.gen.ts
//   backend/internal/values/values_gen.go
//
// A value is either a finite number (a tuning scalar) or a numeric array — flat (e.g. phase
// multipliers) or nested (e.g. per-axis [base, gain] pairs). Scalars become FE `as const`
// numbers / Go untyped consts; arrays become FE readonly tuples / Go `var []float64` (or
// nested `[][]float64`). Strings and non-finite numbers (Infinity/NaN) are rejected — content
// tables (theme CSS, mood color/affect) stay in code, and an "open-ended" tier uses a finite
// bound array instead of Infinity.
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

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isNumArray = (v) => Array.isArray(v) && v.every((x) => isNum(x) || isNumArray(x))

// Validate + classify each value. Throws on anything that isn't a finite number or a (possibly
// nested) array of finite numbers — keeps the generated consts to pure tuning numbers.
const assertValue = (g, k, v) => {
  if (isNum(v)) return 'scalar'
  if (isNumArray(v)) return 'array'
  throw new Error(
    `values.yaml: ${g}.${k} must be a finite number or a numeric array (got ${JSON.stringify(v)})`,
  )
}

// ── TypeScript literal: numbers and numeric arrays serialize verbatim via JSON. ──
const tsLit = (v) => JSON.stringify(v)

// ── Go literals. Scalars → untyped const. Arrays → typed var ([]float64 / [][]float64…). ──
const goType = (v) => (isNum(v) ? 'float64' : '[]' + goType(v[0]))
// Inner composite literals elide their element type ({…}); the var declares the full type.
const goLit = (v) => (isNum(v) ? String(v) : `{${v.map(goLit).join(', ')}}`)
const goVarType = (v) => `${goType(v)}` // top-level array var type, e.g. [][]float64

const doc = parse(readFileSync(srcPath, 'utf8'))
const groups = Object.entries(doc)
if (!groups.length) throw new Error('values.yaml has no groups')
for (const [g, kv] of groups) for (const [k, v] of Object.entries(kv)) assertValue(g, k, v)

// ── TypeScript: nested `VALUES` (camelCase) ──────────────────────────────────────────
const tsGroups = groups
  .map(([g, kv]) => {
    const lines = Object.entries(kv).map(([k, v]) => `    ${camel(k)}: ${tsLit(v)},`)
    return `  ${camel(g)}: {\n${lines.join('\n')}\n  },`
  })
  .join('\n')
const ts = `/* GENERATED FROM spec/values.yaml — DO NOT EDIT. Run \`pnpm gen:values\`. */
export const VALUES = {
${tsGroups}
} as const
`

// ── Go: package `values`. Scalars → one untyped const block per group; arrays → var block. ──
const goBlocks = groups
  .map(([g, kv]) => {
    const scalars = Object.entries(kv).filter(([, v]) => isNum(v))
    const arrays = Object.entries(kv).filter(([, v]) => !isNum(v))
    const parts = [`// ${g}`]
    if (scalars.length) {
      const entries = scalars.map(([k, v]) => ({ name: pascal(g) + pascal(k), val: String(v) }))
      const w = Math.max(...entries.map((e) => e.name.length))
      const lines = entries.map((e) => `\t${e.name.padEnd(w)} = ${e.val}`)
      parts.push(`const (\n${lines.join('\n')}\n)`)
    }
    if (arrays.length) {
      const entries = arrays.map(([k, v]) => ({
        name: pascal(g) + pascal(k),
        decl: `${goVarType(v)}${goLit(v)}`,
      }))
      const w = Math.max(...entries.map((e) => e.name.length))
      const lines = entries.map((e) => `\t${e.name.padEnd(w)} = ${e.decl}`)
      parts.push(`var (\n${lines.join('\n')}\n)`)
    }
    return parts.join('\n')
  })
  .join('\n\n')
const go = `// Code generated from spec/values.yaml — DO NOT EDIT. Run \`pnpm gen:values\`.
//
// Canonical tuning values ("balance patch"). Edit spec/values.yaml, then run \`pnpm gen:values\`.
// Scalar consts are untyped so they drop into float32/float64/int contexts exactly like a
// literal. Numeric-array vars ([]float64 / [][]float64) carry render-only tuning arrays; some
// are unused on the server (FE-only knobs) — that's fine, this file is the shared source.
package values

${goBlocks}
`

mkdirSync(dirname(tsOut), { recursive: true })
mkdirSync(dirname(goOut), { recursive: true })
writeFileSync(tsOut, ts, 'utf8')
writeFileSync(goOut, go, 'utf8')
console.log(`Generated from spec/values.yaml:\n  ${tsOut}\n  ${goOut}`)
