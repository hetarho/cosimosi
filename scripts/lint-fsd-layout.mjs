#!/usr/bin/env node
// FSD structural layout lint — ARCHITECTURE §3.1 rules not covered by steiger or boundaries.
//
// R1  The app layer is segmented; only entrypoints, global style, barrels, and co-located tests
//     may sit at its root.
// R2  Code is grouped by technical role, never generic type folders.
// R3  Mobile product composition lives in pages; app/navigation/screens is reserved for Boot.
// R4  Same-relative pure modules cannot be copied byte-for-byte between web and mobile.

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, join, relative, resolve, sep } from 'node:path'
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
const PURE_MODULE_SEGMENT = /(^|\/)(api|model|lib|config|shared)(\/|$)/
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
      if (
        !mobilePath ||
        !PURE_MODULE_EXT.test(modulePath) ||
        !PURE_MODULE_SEGMENT.test(modulePath)
      ) {
        continue
      }
      if (digest(webPath) === digest(mobilePath)) {
        problems.push(
          `${modulePath} — byte-identical pure module exists in both apps. ` +
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
