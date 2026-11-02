#!/usr/bin/env node
// Package entry lint — ARCH-27's entry rules, executable.
//
// E1  A non-rendering package's root entry reaches no React, React DOM, React Native, three,
//     `@react-three/*`, TanStack React Query or connect-query, through any chain of value imports
//     (its own files and other workspace entries alike). zustand's hook entry is allowed: a store is
//     the package's data, and its hook is how both platforms read it.
// E2  No entry uses `export *`: an entry names what it publishes.
// E3  Exported values no file outside the package imports are a ratchet against
//     scripts/package-dead-exports.baseline.json — a new one fails, a removed one asks to lower it.
// E4  A `react-native` entry that re-exports its default entry (overriding only a platform host)
//     publishes exactly the names the default entry does, so the shared surface cannot drift.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

import { fail, note, ok, repoRoot, section } from './lib.mjs'

// The scene and UI packages ARE the rendering layer (ARCH-27, ARCH-42); their roots may reach React.
export const RENDERING_PACKAGES = new Set([
  '@cosimosi/ui',
  '@cosimosi/3d-renderer',
  '@cosimosi/universe-render',
])
const FORBIDDEN = [
  /^react(\/.*)?$/,
  /^react-dom(\/.*)?$/,
  /^react-native(\/.*)?$/,
  /^three(\/.*)?$/,
  /^@react-three\//,
  /^@tanstack\/react-query(\/.*)?$/,
  /^@connectrpc\/connect-query(\/.*)?$/,
]
export const DEAD_EXPORTS_BASELINE = 'scripts/package-dead-exports.baseline.json'
const SOURCE = /\.(ts|tsx|js|jsx|mjs)$/
const TEST = /\.(test|spec)\.[jt]sx?$/

const portable = (root, file) => relative(root, file).split(sep).join('/')

function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      return ['node_modules', 'gen', 'dist'].includes(entry.name) || entry.name.startsWith('.')
        ? []
        : walk(path)
    return SOURCE.test(entry.name) ? [path] : []
  })
}

// Every workspace package: name → { dir, exports: subpath → default entry file, native: subpath →
// the `react-native` condition's file where one exists }.
export function workspacePackages(root = repoRoot) {
  const packages = new Map()
  const base = join(root, 'packages')
  if (!existsSync(base)) return packages
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    const manifest = join(base, entry.name, 'package.json')
    if (!entry.isDirectory() || !existsSync(manifest)) continue
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
    const exportsMap = {}
    const nativeMap = {}
    for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
      const file = typeof target === 'string' ? target : (target?.default ?? target?.import)
      if (typeof file === 'string' && SOURCE.test(file))
        exportsMap[subpath] = resolve(base, entry.name, file)
      const native = typeof target === 'object' ? target?.['react-native'] : null
      if (typeof native === 'string' && SOURCE.test(native))
        nativeMap[subpath] = resolve(base, entry.name, native)
    }
    packages.set(pkg.name, { dir: join(base, entry.name), exports: exportsMap, native: nativeMap })
  }
  return packages
}

const parsed = new Map()
function parse(file) {
  if (!parsed.has(file)) {
    const text = readFileSync(file, 'utf8')
    const kind = /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    parsed.set(file, ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind))
  }
  return parsed.get(file)
}

// The module specifiers a file reaches at runtime, and whether it renders JSX itself.
function valueImports(file) {
  const source = parse(file)
  const specifiers = []
  let jsx = false
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const clause = node.importClause
      const typeOnly =
        clause?.isTypeOnly ||
        (clause &&
          !clause.name &&
          clause.namedBindings &&
          ts.isNamedImports(clause.namedBindings) &&
          clause.namedBindings.elements.length > 0 &&
          clause.namedBindings.elements.every((element) => element.isTypeOnly))
      if (!typeOnly) specifiers.push(node.moduleSpecifier.text)
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      const typeOnly =
        node.isTypeOnly ||
        (node.exportClause &&
          ts.isNamedExports(node.exportClause) &&
          node.exportClause.elements.every((element) => element.isTypeOnly))
      if (!typeOnly) specifiers.push(node.moduleSpecifier.text)
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteralLike(node.arguments[0])
    )
      specifiers.push(node.arguments[0].text)
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node))
      jsx = true
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { specifiers, jsx }
}

function resolveRelative(from, specifier) {
  const target = resolve(dirname(from), specifier)
  return [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    join(target, 'index.ts'),
    join(target, 'index.tsx'),
  ].find((candidate) => existsSync(candidate) && SOURCE.test(candidate))
}

function resolveWorkspace(packages, specifier) {
  const match = /^(@cosimosi\/[^/]+)(\/.*)?$/.exec(specifier)
  if (!match) return null
  const pkg = packages.get(match[1])
  if (!pkg) return null
  return pkg.exports[`.${match[2] ?? ''}`] ?? null
}

// E1: the first forbidden module a root entry reaches, as the chain that reaches it.
function forbiddenReach(root, entry, packages) {
  const seen = new Set([entry])
  const queue = [[entry, [portable(root, entry)]]]
  while (queue.length > 0) {
    const [file, chain] = queue.shift()
    const { specifiers, jsx } = valueImports(file)
    if (jsx) return [...chain, 'JSX (react/jsx-runtime)']
    for (const specifier of specifiers) {
      if (FORBIDDEN.some((pattern) => pattern.test(specifier))) return [...chain, specifier]
      const next = specifier.startsWith('.')
        ? resolveRelative(file, specifier)
        : resolveWorkspace(packages, specifier)
      if (!next || seen.has(next)) continue
      seen.add(next)
      queue.push([next, [...chain, specifier]])
    }
  }
  return null
}

// Every name an entry file declares it publishes, values and types alike.
function exportedNames(file) {
  const names = []
  for (const statement of parse(file).statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause) {
      if (ts.isNamedExports(statement.exportClause))
        for (const element of statement.exportClause.elements) names.push(element.name.text)
      continue
    }
    const exported = ts
      .getModifiers?.(statement)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    if (exported && 'name' in statement && statement.name && ts.isIdentifier(statement.name))
      names.push(statement.name.text)
    if (exported && ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text)
  }
  return names
}

function hasExportStar(file) {
  return parse(file).statements.some(
    (statement) =>
      ts.isExportDeclaration(statement) && !statement.exportClause && statement.moduleSpecifier,
  )
}

export function findEntryProblems(root = repoRoot) {
  parsed.clear()
  const packages = workspacePackages(root)
  const problems = []
  for (const [name, pkg] of packages) {
    for (const [subpath, entry] of [
      ...Object.entries(pkg.exports),
      ...Object.entries(pkg.native),
    ]) {
      if (!existsSync(entry)) continue
      if (hasExportStar(entry))
        problems.push(`${portable(root, entry)} — entry uses \`export *\`; name what it publishes`)
    }
    for (const [subpath, nativeEntry] of Object.entries(pkg.native)) {
      const entry = pkg.exports[subpath]
      if (!entry || !existsSync(entry) || !existsSync(nativeEntry)) continue
      const reexportsDefault = parse(nativeEntry).statements.some(
        (statement) =>
          ts.isExportDeclaration(statement) &&
          statement.moduleSpecifier &&
          resolveRelative(nativeEntry, statement.moduleSpecifier.text) === entry,
      )
      if (!reexportsDefault) continue
      const web = new Set(exportedNames(entry))
      const native = new Set(exportedNames(nativeEntry))
      const onlyWeb = [...web].filter((value) => !native.has(value))
      const onlyNative = [...native].filter((value) => !web.has(value))
      if (onlyWeb.length > 0 || onlyNative.length > 0)
        problems.push(
          `${name}${subpath.slice(1)} — the react-native entry differs from the default (web only: ${onlyWeb.join(', ') || '-'}; native only: ${onlyNative.join(', ') || '-'})`,
        )
    }
    const rootEntry = pkg.exports['.']
    if (RENDERING_PACKAGES.has(name) || !rootEntry || !existsSync(rootEntry)) continue
    const chain = forbiddenReach(root, rootEntry, packages)
    if (chain)
      problems.push(
        `${name} — root entry reaches ${chain.at(-1)} via ${chain.slice(0, -1).join(' → ')}; move it behind a ./react subpath`,
      )
  }
  return problems
}

// The value names an entry publishes (types are free: they cost nothing at runtime).
function exportedValues(file, packages, seen = new Set()) {
  if (seen.has(file)) return []
  seen.add(file)
  const names = []
  for (const statement of parse(file).statements) {
    const exported = ts
      .getModifiers?.(statement)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue
      if (!statement.exportClause && statement.moduleSpecifier) {
        const specifier = statement.moduleSpecifier.text
        const next = specifier.startsWith('.')
          ? resolveRelative(file, specifier)
          : resolveWorkspace(packages, specifier)
        if (next) names.push(...exportedValues(next, packages, seen))
        continue
      }
      if (statement.exportClause && ts.isNamedExports(statement.exportClause))
        for (const element of statement.exportClause.elements)
          if (!element.isTypeOnly) names.push(element.name.text)
      continue
    }
    if (!exported) continue
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      if (statement.name) names.push(statement.name.text)
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text)
    } else if (ts.isEnumDeclaration(statement)) names.push(statement.name.text)
  }
  return names
}

// Every name imported (or re-exported) from each workspace specifier, by files outside its package.
function outsideImports(root, packages) {
  const used = new Map()
  const record = (specifier, name) => {
    if (!used.has(specifier)) used.set(specifier, new Set())
    used.get(specifier).add(name)
  }
  const files = [
    ...walk(join(root, 'apps')).filter((file) => !file.includes(`${sep}node_modules${sep}`)),
    ...walk(join(root, 'packages')),
  ]
  for (const file of files) {
    const owner = [...packages.values()].find((pkg) => file.startsWith(pkg.dir + sep))
    const source = parse(file)
    const visit = (node) => {
      const specifierNode =
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
      if (specifierNode && ts.isStringLiteralLike(specifierNode)) {
        const specifier = specifierNode.text
        const match = /^(@cosimosi\/[^/]+)/.exec(specifier)
        const target = match && packages.get(match[1])
        if (target && target !== owner) {
          if (ts.isImportDeclaration(node)) {
            const clause = node.importClause
            if (clause?.name) record(specifier, 'default')
            const bindings = clause?.namedBindings
            if (bindings && ts.isNamespaceImport(bindings)) record(specifier, '*')
            if (bindings && ts.isNamedImports(bindings))
              for (const element of bindings.elements)
                record(specifier, (element.propertyName ?? element.name).text)
          } else if (node.exportClause && ts.isNamedExports(node.exportClause)) {
            for (const element of node.exportClause.elements)
              record(specifier, (element.propertyName ?? element.name).text)
          } else record(specifier, '*')
        }
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        ts.isStringLiteralLike(node.arguments[0])
      )
        record(node.arguments[0].text, '*')
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return used
}

// E3: entry specifier → exported values nothing outside the package imports.
export function findDeadExports(root = repoRoot) {
  parsed.clear()
  const packages = workspacePackages(root)
  const used = outsideImports(root, packages)
  const dead = {}
  for (const [name, pkg] of packages) {
    for (const [subpath, entry] of Object.entries(pkg.exports)) {
      if (!existsSync(entry)) continue
      const specifier = `${name}${subpath.slice(1)}`
      const imported = used.get(specifier) ?? new Set()
      if (imported.has('*')) continue
      const names = [...new Set(exportedValues(entry, packages))]
        .filter((value) => !imported.has(value))
        .sort()
      if (names.length > 0) dead[specifier] = names
    }
  }
  return dead
}

export function compareDeadExports(measured, baseline) {
  const added = []
  const removed = []
  for (const [specifier, names] of Object.entries(measured))
    for (const value of names)
      if (!(baseline[specifier] ?? []).includes(value)) added.push(`${specifier}: ${value}`)
  for (const [specifier, names] of Object.entries(baseline))
    for (const value of names)
      if (!(measured[specifier] ?? []).includes(value)) removed.push(`${specifier}: ${value}`)
  return { added, removed }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  section('package entries (ARCH-27)')
  const problems = findEntryProblems()
  const measured = findDeadExports()
  const baselinePath = join(repoRoot, DEAD_EXPORTS_BASELINE)
  if (process.argv.includes('--write-baseline')) {
    writeFileSync(baselinePath, `${JSON.stringify(measured, null, 2)}\n`)
    note(`wrote ${DEAD_EXPORTS_BASELINE}`)
  }
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {}
  const { added, removed } = compareDeadExports(measured, baseline)
  for (const value of added)
    problems.push(`${value} — exported, but nothing outside its package imports it`)
  if (removed.length > 0)
    note(`${removed.length} dead export(s) left the baseline; lower ${DEAD_EXPORTS_BASELINE}`)
  for (const problem of problems) console.error(`  \x1b[31m✗\x1b[0m ${problem}`)
  if (problems.length > 0) fail(`${problems.length} package entry violation(s). See ARCH-27.`)
  const total = Object.values(measured).reduce((sum, names) => sum + names.length, 0)
  ok(
    `entries are named, rendering-free where they must be, and ${total} dead export(s) are baselined`,
  )
}
