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
const isStr = (v) => typeof v === 'string'
// A scalar map is a one-level object whose values are ALL finite numbers or ALL strings (e.g.
// customization.price / .free) — an item-id → price / axis → free-kind table. Keys are stable
// identifiers (item ids like "star:aurora") and are emitted VERBATIM (never camel/pascal-cased).
const isScalarMap = (v) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.values(v).length > 0 &&
  (Object.values(v).every(isNum) || Object.values(v).every(isStr))

// Validate + classify each value. Tuning scalars stay numbers/numeric-arrays; the customization
// economy (spec 44) also allows string scalars and one-level scalar maps (price/free config).
const assertValue = (g, k, v) => {
  if (isNum(v)) return 'scalar'
  if (isNumArray(v)) return 'array'
  if (isStr(v)) return 'string'
  if (isScalarMap(v)) return 'map'
  throw new Error(
    `values.yaml: ${g}.${k} must be a finite number, a numeric array, a string, or a one-level ` +
      `scalar map (got ${JSON.stringify(v)})`,
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
const goMapLit = (v) => {
  const valType = Object.values(v).every(isNum) ? 'int' : 'string'
  // gofmt aligns map values into a column: pad each "key": to the widest, then one space.
  const rows = Object.entries(v).map(([mk, mv]) => ({
    key: `${JSON.stringify(mk)}:`,
    val: valType === 'string' ? JSON.stringify(mv) : String(mv),
  }))
  const w = Math.max(...rows.map((r) => r.key.length))
  const pairs = rows.map((r) => `\t\t${r.key.padEnd(w)} ${r.val},`)
  return `map[string]${valType}{\n${pairs.join('\n')}\n\t}`
}
const goBlocks = groups
  .map(([g, kv]) => {
    // Number + string scalars share one untyped `const (…)` block (numbers byte-identical to
    // before — string consts only appear in groups that declare them); numeric arrays and scalar
    // maps each get a `var (…)` block.
    const scalars = Object.entries(kv).filter(([, v]) => isNum(v) || isStr(v))
    const arrays = Object.entries(kv).filter(([, v]) => isNumArray(v))
    const maps = Object.entries(kv).filter(([, v]) => isScalarMap(v))
    const parts = [`// ${g}`]
    if (scalars.length) {
      const entries = scalars.map(([k, v]) => ({
        name: pascal(g) + pascal(k),
        val: isStr(v) ? JSON.stringify(v) : String(v),
      }))
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
    if (maps.length) {
      // Stable-id keys (e.g. "star:aurora") can't be Go identifiers — emit one `map[string]…`
      // var per table with the raw keys verbatim (NO per-key const, NO key transform).
      const lines = maps.map(([k, v]) => `\t${pascal(g) + pascal(k)} = ${goMapLit(v)}`)
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
