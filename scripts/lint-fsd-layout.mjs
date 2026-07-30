#!/usr/bin/env node
// FSD structural layout lint — ARCHITECTURE §3.1 rules not covered by steiger or boundaries.
//
// R1  The app layer is segmented; only entrypoints, global style, barrels, and co-located tests
//     may sit at its root.
// R2  Code is grouped by technical role, never generic type folders.
// R3  Mobile product composition lives in pages; app/navigation/screens is reserved for Boot.
// R4  Same-relative pure modules cannot be copied byte-for-byte between web and mobile. `ui` counts
//     as pure when the file carries no platform marker and more than a wiring shell's worth of code.

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, join, relative, resolve, sep } from 'node:path'
import ts from 'typescript'
import { repoRoot, section, ok, note, fail } from './lib.mjs'

const APPS = ['apps/web', 'apps/mobile']
const APP_ROOT_ALLOW = new Set([
  'App.tsx',
  'App.test.tsx',
  'main.tsx',
  'main.test.tsx',
  'index.css',
  'index.ts',
])
const MOBILE_NAVIGATION_SCREEN_ALLOW = new Set(['BootScreen.tsx'])
const CODE_EXT = /\.(ts|tsx|js|jsx|css)$/
const PURE_MODULE_EXT = /\.(ts|tsx|js|jsx)$/
const PURE_MODULE_SEGMENT =
  /(^|\/)(api|model|lib|config|shared)(\/|$)|(^|\/)app\/(providers|model)(\/|$)/
// `ui` is included conditionally, not by path alone: it is the one segment where a file may
// legitimately be forked per platform, and it is also where a platform-pure hook shell most
// plausibly lands. A `ui` file joins R4 only when uiSegmentIsPureModule says it is both
// platform-pure and more than a wiring shell.
const UI_SEGMENT = /(^|\/)ui(\/|$)/
// A native sibling is §3.5's sanctioned fork. It can never collide across apps at the same relative
// path anyway, but skipping it keeps the rule's intent legible where it is read.
const NATIVE_SIBLING = /\.native\.[cm]?[jt]sx?$/

// Platform markers. A file carrying one of these is genuinely forked and must not be compared: each
// arm names a thing that cannot exist on the other platform. The set is deliberately tight — a false
// positive here fails the whole `pnpm lint` gate, the same warning lint-comment-history.mjs carries.
const PLATFORM_MARKERS = [
  // RN and the native navigation/runtime packages, in any import or require form.
  /from\s+['"](react-native|react-native-.*|expo|expo-.*|@react-navigation\/.*)['"]/,
  /require\(\s*['"](react-native|react-native-.*|expo|expo-.*)['"]\s*\)/,
  // The web renderer, and DOM globals a native bundle has no binding for.
  /from\s+['"]react-dom(\/.*)?['"]/,
  /\b(document|window|navigator|localStorage|sessionStorage)\s*\./,
  /\bHTML[A-Z]\w*Element\b/,
  // A lowercase JSX tag is a DOM intrinsic; RN renders capitalized components only.
  /<[a-z][a-z0-9]*(\s|\/?>)/,
]

// The line between a wiring shell and an implementation. A shell resolves what its app owns and
// delegates — at most a declaration, a lookup, the call and a return. Anything past that is behavior,
// and behavior copied sideways is exactly what §3.1 forbids. Imports and re-exports do not count,
// which is also why the per-app `index.ts` barrels (structurally required public APIs) stay out of
// R4's way.
const UI_SHELL_STATEMENT_LIMIT = 4

function countStatements(source, path) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  let statements = 0
  const visit = (node) => {
    if (
      ts.isStatement(node) &&
      !ts.isImportDeclaration(node) &&
      !ts.isExportDeclaration(node) &&
      !ts.isBlock(node)
    ) {
      statements += 1
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(file, visit)
  return statements
}

// A `ui` file is subject to R4 when it could actually be promoted: no platform marker, and more than
// a shell's worth of code. Both halves are load-bearing — without the first the rule would demand
// promoting a genuinely forked component, and without the second it would demand promoting a
// two-line delegation whose only app-local dependency (the copy) cannot move into a package.
function uiSegmentIsPureModule(path) {
  const source = readFileSync(path, 'utf8')
  if (PLATFORM_MARKERS.some((marker) => marker.test(source))) return false
  return countStatements(source, path) > UI_SHELL_STATEMENT_LIMIT
}
const GENERIC_SEGMENTS = new Set([
  'components',
  'hooks',
  'utils',
  'helpers',
  'types',
  'constants',
  'misc',
])

function walkFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walkFiles(path) : [path]
  })
}

function walkDirectories(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return []
    const path = join(dir, entry.name)
    return [path, ...walkDirectories(path)]
  })
}

function portableRelative(from, to) {
  return relative(from, to).split(sep).join('/')
}

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function normalizedDigest(path) {
  const source = readFileSync(path, 'utf8')
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.JSX, source)
  const identifiers = new Map()
  const hash = createHash('sha256')

  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token === ts.SyntaxKind.Identifier || token === ts.SyntaxKind.PrivateIdentifier) {
      const identifier = scanner.getTokenText()
      if (!identifiers.has(identifier)) identifiers.set(identifier, identifiers.size)
      hash.update(`identifier:${identifiers.get(identifier)}\n`)
      continue
    }
    hash.update(`${token}:${scanner.getTokenText()}\n`)
  }
  return hash.digest('hex')
}

export function findFsdLayoutProblems(root = repoRoot, apps = APPS) {
  const problems = []

  for (const app of apps) {
    const srcAbs = join(root, app, 'src')
    if (!existsSync(srcAbs)) continue

    const appAbs = join(srcAbs, 'app')
    if (existsSync(appAbs)) {
      for (const entry of readdirSync(appAbs, { withFileTypes: true })) {
        if (!entry.isDirectory() && CODE_EXT.test(entry.name) && !APP_ROOT_ALLOW.has(entry.name)) {
          problems.push(
            `${app}/src/app/${entry.name} — loose file in the app layer. Move it into a segment ` +
              `(app/providers · app/routes|navigation · app/model · app/styles). Only ` +
              `[${[...APP_ROOT_ALLOW].join(', ')}] may sit at the app root.`,
          )
        }
      }
    }

    for (const path of walkDirectories(srcAbs)) {
      const segment = basename(path)
      if (GENERIC_SEGMENTS.has(segment)) {
        problems.push(
          `${portableRelative(root, path)} — generic '${segment}/' folder. ` +
            `FSD groups by technical role (ui/model/api/lib/config), not by type.`,
        )
      }
    }
  }

  const mobileProductScreens = join(root, 'apps/mobile/src/app/navigation/screens')
  for (const path of walkFiles(mobileProductScreens)) {
    const name = portableRelative(mobileProductScreens, path)
    if (PURE_MODULE_EXT.test(name) && !MOBILE_NAVIGATION_SCREEN_ALLOW.has(name)) {
      problems.push(
        `${portableRelative(root, path)} — product composition in app/navigation/screens. ` +
          `Move it to pages/<slice>/ui and import its public API from the route adapter; only ` +
          `BootScreen.tsx may remain as neutral app-shell infrastructure.`,
      )
    }
  }

  const [webApp, mobileApp] = apps
  if (webApp && mobileApp) {
    const webSrc = join(root, webApp, 'src')
    const mobileSrc = join(root, mobileApp, 'src')
    const mobileFiles = new Map(
      walkFiles(mobileSrc).map((path) => [portableRelative(mobileSrc, path), path]),
    )
    for (const webPath of walkFiles(webSrc)) {
      const modulePath = portableRelative(webSrc, webPath)
      const mobilePath = mobileFiles.get(modulePath)
      if (!mobilePath || !PURE_MODULE_EXT.test(modulePath) || NATIVE_SIBLING.test(modulePath)) {
        continue
      }
      const comparable =
        PURE_MODULE_SEGMENT.test(modulePath) ||
        (UI_SEGMENT.test(modulePath) &&
          uiSegmentIsPureModule(webPath) &&
          uiSegmentIsPureModule(mobilePath))
      if (!comparable) continue
      const byteIdentical = digest(webPath) === digest(mobilePath)
      const normalizedEquivalent =
        byteIdentical || normalizedDigest(webPath) === normalizedDigest(mobilePath)
      if (normalizedEquivalent) {
        problems.push(
          `${modulePath} — ${byteIdentical ? 'byte-identical' : 'normalized-equivalent'} pure module exists in both apps. ` +
            `Promote the implementation to its owning domain package and let both apps import it.`,
        )
      }
    }
  }

  return problems
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  section('FSD structural layout (ARCHITECTURE §3.1)')
  for (const app of APPS) {
    const appAbs = join(repoRoot, app, 'src/app')
    if (!existsSync(appAbs)) continue
    const segments = readdirSync(appAbs, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    note(`${app}/src/app segments: ${segments.join(', ') || '(none)'}`)
  }

  const problems = findFsdLayoutProblems()
  if (problems.length) {
    for (const problem of problems) console.error(`  \x1b[31m✗\x1b[0m ${problem}`)
    fail(
      `${problems.length} FSD layout violation(s). See ARCHITECTURE.md §3.1 ` +
        `(layers/slices/segments and cross-app package ownership).`,
    )
  }

  ok('app layout, mobile pages placement, and cross-app pure-module ownership are valid')
}
