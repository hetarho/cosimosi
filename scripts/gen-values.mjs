#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultSrcPath = join(root, 'spec', 'values.yaml')
const defaultTsOut = join(root, 'packages', 'config', 'src', 'values.gen.ts')
const defaultGoOut = join(root, 'apps', 'api', 'internal', 'platform', 'values', 'values_gen.go')

const snakeCase = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/

const camel = (value) => value.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
const pascal = (value) => value.replace(/(^|_)([a-z0-9])/g, (_, __, c) => c.toUpperCase())

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value)
const isString = (value) => typeof value === 'string'
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function describeValue(value) {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN'
    if (value === Infinity) return 'Infinity'
    if (value === -Infinity) return '-Infinity'
    return String(value)
  }
  return JSON.stringify(value)
}

function assertName(kind, value) {
  if (!snakeCase.test(value)) {
    throw new Error(`values.yaml: ${kind} "${value}" must be snake_case`)
  }
}

function assertFiniteNumber(path, value) {
  if (!isFiniteNumber(value)) {
    throw new Error(`values.yaml: ${path} must be finite (got ${describeValue(value)})`)
  }
}

function classifyArray(path, value) {
  if (!value.length) {
    throw new Error(`values.yaml: ${path} numeric arrays must contain at least one finite number`)
  }
  for (const [index, item] of value.entries()) {
    if (typeof item === 'number') {
      assertFiniteNumber(`${path}[${index}]`, item)
      continue
    }
    throw new Error(`values.yaml: ${path} numeric arrays must contain only finite numbers`)
  }
  return 'number_array'
}

function classifyScalarMap(path, value) {
  const entries = Object.entries(value)
  if (!entries.length) {
    throw new Error(`values.yaml: ${path} scalar maps must not be empty`)
  }

  const valueKinds = new Set()
  for (const [mapKey, mapValue] of entries) {
    if (!mapKey) {
      throw new Error(`values.yaml: ${path} scalar map keys must not be empty`)
    }
    assertName('scalar map key', mapKey)
    if (typeof mapValue === 'number') {
      assertFiniteNumber(`${path}.${mapKey}`, mapValue)
      valueKinds.add('number')
      continue
    }
    if (isString(mapValue)) {
      valueKinds.add('string')
      continue
    }
    throw new Error(`values.yaml: ${path} must be a one-level scalar map`)
  }

  if (valueKinds.size > 1) {
    throw new Error(`values.yaml: ${path} scalar map values must all share one scalar type`)
  }

  return valueKinds.has('number') ? 'number_map' : 'string_map'
}

function classifyValue(group, key, value) {
  const path = `${group}.${key}`
  if (typeof value === 'number') {
    assertFiniteNumber(path, value)
    return 'number'
  }
  if (isString(value)) return 'string'
  if (Array.isArray(value)) return classifyArray(path, value)
  if (isPlainObject(value)) return classifyScalarMap(path, value)
  throw new Error(
    `values.yaml: ${path} must be a finite number, numeric array, string, or one-level scalar map ` +
      `(got ${describeValue(value)})`,
  )
}

export function validateValuesDocument(doc) {
  if (!isPlainObject(doc)) {
    throw new Error('values.yaml must contain grouped values')
  }

  const groups = Object.entries(doc)
  if (!groups.length) throw new Error('values.yaml has no groups')

  const normalizedGroups = groups.map(([group, values]) => {
    assertName('group', group)
    if (!isPlainObject(values)) {
      throw new Error(`values.yaml: ${group} must be an object`)
    }

    const entries = Object.entries(values)
    if (!entries.length) {
      throw new Error(`values.yaml: ${group} must contain at least one value`)
    }

    return {
      name: group,
      values: entries.map(([key, value]) => {
        assertName('key', key)
        return {
          key,
          kind: classifyValue(group, key, value),
          value,
        }
      }),
    }
  })

  assertUniqueGeneratedNames(normalizedGroups)
  return normalizedGroups
}

function assertUniqueGeneratedName(kind, generatedName, sourcePath, seen) {
  const previous = seen.get(generatedName)
  if (previous) {
    throw new Error(
      `values.yaml: ${sourcePath} generates duplicate ${kind} "${generatedName}" already used by ${previous}`,
    )
  }
  seen.set(generatedName, sourcePath)
}

function assertUniqueGeneratedNames(groups) {
  const tsGroups = new Map()
  const goNames = new Map()

  for (const group of groups) {
    assertUniqueGeneratedName('TypeScript group name', camel(group.name), group.name, tsGroups)

    const tsKeys = new Map()
    for (const { key } of group.values) {
      const sourcePath = `${group.name}.${key}`
      assertUniqueGeneratedName('TypeScript key name', camel(key), sourcePath, tsKeys)
      assertUniqueGeneratedName('Go constant name', pascal(group.name) + pascal(key), sourcePath, goNames)
    }
  }
}

function tsLiteral(value) {
  return JSON.stringify(value)
}

function renderTypeScript(groups) {
  const tsGroups = groups
    .map(({ name, values }) => {
      const lines = values.map(({ key, value }) => `    ${camel(key)}: ${tsLiteral(value)},`)
      return `  ${camel(name)}: {\n${lines.join('\n')}\n  },`
    })
    .join('\n')

  return `/* GENERATED FROM spec/values.yaml - DO NOT EDIT. Run \`pnpm gen:values\`. */
export const VALUES = {
${tsGroups}
} as const
`
}

function goNumberLiteral(value) {
  return String(value)
}

function goArrayLiteral(value) {
  return `[]float64{${value.map(goNumberLiteral).join(', ')}}`
}

function goMapLiteral(value, kind) {
  const valueType = kind === 'number_map' ? 'float64' : 'string'
  const rows = Object.entries(value).map(([mapKey, mapValue]) => ({
    key: `${JSON.stringify(mapKey)}:`,
    value: kind === 'string_map' ? JSON.stringify(mapValue) : goNumberLiteral(mapValue),
  }))
  const width = Math.max(...rows.map((row) => row.key.length))
  const entries = rows.map((row) => `\t\t${row.key.padEnd(width)} ${row.value},`)
  return `map[string]${valueType}{\n${entries.join('\n')}\n\t}`
}

function renderGo(groups) {
  const goBlocks = groups
    .map(({ name, values }) => {
      const scalars = values.filter(({ kind }) => kind === 'number' || kind === 'string')
      const arrays = values.filter(({ kind }) => kind === 'number_array')
      const maps = values.filter(({ kind }) => kind === 'number_map' || kind === 'string_map')
      const decls = []

      if (scalars.length) {
        const entries = scalars.map(({ key, value }) => ({
          name: pascal(name) + pascal(key),
          value: isString(value) ? JSON.stringify(value) : goNumberLiteral(value),
        }))
        const width = Math.max(...entries.map((entry) => entry.name.length))
        decls.push({ kind: 'const', text: `const (\n${entries.map((entry) => `\t${entry.name.padEnd(width)} = ${entry.value}`).join('\n')}\n)` })
      }

      if (arrays.length) {
        const entries = arrays.map(({ key, value }) => ({
          name: pascal(name) + pascal(key),
          value: goArrayLiteral(value),
        }))
        const width = Math.max(...entries.map((entry) => entry.name.length))
        decls.push({ kind: 'var', text: `var (\n${entries.map((entry) => `\t${entry.name.padEnd(width)} = ${entry.value}`).join('\n')}\n)` })
      }

      if (maps.length) {
        const lines = maps.map(({ key, kind, value }) => `\t${pascal(name) + pascal(key)} = ${goMapLiteral(value, kind)}`)
        decls.push({ kind: 'var', text: `var (\n${lines.join('\n')}\n)` })
      }

      // gofmt inserts a blank line between top-level declaration blocks of different
      // kinds (const → var); emit it so the generated Go stays gofmt-clean and
      // check:gen can't disagree with lint:api. Same-kind blocks stay adjacent.
      let block = `// ${name}`
      decls.forEach((decl, index) => {
        const changedKind = index > 0 && decls[index - 1].kind !== decl.kind
        block += `${changedKind ? '\n\n' : '\n'}${decl.text}`
      })
      return block
    })
    .join('\n\n')

  return `// Code generated from spec/values.yaml - DO NOT EDIT. Run \`pnpm gen:values\`.
package values

${goBlocks}
`
}

export function generateValues({
  srcPath = defaultSrcPath,
  tsOut = defaultTsOut,
  goOut = defaultGoOut,
  quiet = false,
} = {}) {
  if (!existsSync(srcPath)) {
    if (!quiet) console.log('  * gen:values skipped: spec/values.yaml is not present')
    return { skipped: true, groups: [] }
  }

  const doc = parse(readFileSync(srcPath, 'utf8'))
  const groups = validateValuesDocument(doc)
  const outputs = [
    [tsOut, renderTypeScript(groups)],
    [goOut, renderGo(groups)],
  ]

  for (const [path, content] of outputs) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content, 'utf8')
  }

  if (!quiet) console.log(`Generated from spec/values.yaml:\n  ${tsOut}\n  ${goOut}`)
  return { skipped: false, groups }
}

function isDirectRun() {
  return process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
}

if (isDirectRun()) {
  try {
    generateValues()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
