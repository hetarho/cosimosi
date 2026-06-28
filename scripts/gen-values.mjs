#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcPath = join(root, 'spec', 'values.yaml')
const tsOut = join(root, 'packages', 'config', 'src', 'values.gen.ts')
const goOut = join(root, 'apps', 'api', 'internal', 'values', 'values_gen.go')

if (!existsSync(srcPath)) {
  console.log('  * gen:values skipped: spec/values.yaml is not present')
  process.exit(0)
}

const snakeCase = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/

const camel = (value) => value.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
const pascal = (value) => value.replace(/(^|_)([a-z0-9])/g, (_, __, c) => c.toUpperCase())

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)
const isNumberArray = (value) => Array.isArray(value) && value.length > 0 && value.every((item) => isNumber(item) || isNumberArray(item))
const isString = (value) => typeof value === 'string'
const isScalarMap = (value) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const entries = Object.entries(value)
  if (!entries.length) return false
  return entries.every(([, item]) => isNumber(item)) || entries.every(([, item]) => isString(item))
}

function assertName(kind, value) {
  if (!snakeCase.test(value)) {
    throw new Error(`values.yaml: ${kind} "${value}" must be snake_case`)
  }
}

function assertValue(group, key, value) {
  if (isNumber(value) || isNumberArray(value) || isString(value) || isScalarMap(value)) return
  throw new Error(
    `values.yaml: ${group}.${key} must be a finite number, numeric array, string, or one-level scalar map ` +
      `(got ${JSON.stringify(value)})`,
  )
}

const doc = parse(readFileSync(srcPath, 'utf8'))
if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
  throw new Error('values.yaml must contain grouped values')
}

const groups = Object.entries(doc)
if (!groups.length) throw new Error('values.yaml has no groups')

for (const [group, values] of groups) {
  assertName('group', group)
  if (values === null || typeof values !== 'object' || Array.isArray(values)) {
    throw new Error(`values.yaml: ${group} must be an object`)
  }
  for (const [key, value] of Object.entries(values)) {
    assertName('key', key)
    assertValue(group, key, value)
  }
}

const tsLiteral = (value) => JSON.stringify(value)

const tsGroups = groups
  .map(([group, values]) => {
    const lines = Object.entries(values).map(([key, value]) => `    ${camel(key)}: ${tsLiteral(value)},`)
    return `  ${camel(group)}: {\n${lines.join('\n')}\n  },`
  })
  .join('\n')

const ts = `/* GENERATED FROM spec/values.yaml - DO NOT EDIT. Run \`pnpm gen:values\`. */
export const VALUES = {
${tsGroups}
} as const
`

const goType = (value) => (isNumber(value) ? 'float64' : `[]${goType(value[0])}`)
const goLiteral = (value) => (isNumber(value) ? String(value) : `{${value.map(goLiteral).join(', ')}}`)

function goMapLiteral(value) {
  const valueType = Object.values(value).every(isNumber) ? 'int' : 'string'
  const rows = Object.entries(value).map(([mapKey, mapValue]) => ({
    key: `${JSON.stringify(mapKey)}:`,
    value: valueType === 'string' ? JSON.stringify(mapValue) : String(mapValue),
  }))
  const width = Math.max(...rows.map((row) => row.key.length))
  const entries = rows.map((row) => `\t\t${row.key.padEnd(width)} ${row.value},`)
  return `map[string]${valueType}{\n${entries.join('\n')}\n\t}`
}

const goBlocks = groups
  .map(([group, values]) => {
    const scalars = Object.entries(values).filter(([, value]) => isNumber(value) || isString(value))
    const arrays = Object.entries(values).filter(([, value]) => isNumberArray(value))
    const maps = Object.entries(values).filter(([, value]) => isScalarMap(value))
    const parts = [`// ${group}`]

    if (scalars.length) {
      const entries = scalars.map(([key, value]) => ({
        name: pascal(group) + pascal(key),
        value: isString(value) ? JSON.stringify(value) : String(value),
      }))
      const width = Math.max(...entries.map((entry) => entry.name.length))
      parts.push(`const (\n${entries.map((entry) => `\t${entry.name.padEnd(width)} = ${entry.value}`).join('\n')}\n)`)
    }

    if (arrays.length) {
      const entries = arrays.map(([key, value]) => ({
        name: pascal(group) + pascal(key),
        value: `${goType(value)}${goLiteral(value)}`,
      }))
      const width = Math.max(...entries.map((entry) => entry.name.length))
      parts.push(`var (\n${entries.map((entry) => `\t${entry.name.padEnd(width)} = ${entry.value}`).join('\n')}\n)`)
    }

    if (maps.length) {
      const lines = maps.map(([key, value]) => `\t${pascal(group) + pascal(key)} = ${goMapLiteral(value)}`)
      parts.push(`var (\n${lines.join('\n')}\n)`)
    }

    return parts.join('\n')
  })
  .join('\n\n')

const go = `// Code generated from spec/values.yaml - DO NOT EDIT. Run \`pnpm gen:values\`.
package values

${goBlocks}
`

mkdirSync(dirname(tsOut), { recursive: true })
mkdirSync(dirname(goOut), { recursive: true })
writeFileSync(tsOut, ts, 'utf8')
writeFileSync(goOut, go, 'utf8')
console.log(`Generated from spec/values.yaml:\n  ${tsOut}\n  ${goOut}`)
