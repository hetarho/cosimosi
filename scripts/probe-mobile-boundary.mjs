#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, rmSync, rmdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fail, ok, repoRoot, section } from './lib.mjs'

// This probe proves the FSD boundary rules actually fire — a green `eslint` config could silently
// stop enforcing them. It injects temp fixtures under src/, runs `lint:boundaries`, and asserts
// the forbidden imports are caught and the allowed ones are not. Cases (plan 23 layering + plan
// 24's `@x` anti-corruption seam):
//   FORBIDDEN  entities → pages                          (layer direction)
//   FORBIDDEN  entities → another entity's private model (no same-layer reach past `@x`)
//   FORBIDDEN  an `@x` file → another slice's model      (`@x` reaches only its OWN slice)
//   ALLOWED    entities → another entity's `@x`          (the sanctioned same-layer cross-import)
//   ALLOWED    an `@x` file → its OWN slice's model
const pagesRoot = join(repoRoot, 'apps/mobile/src/pages')
const entitiesRoot = join(repoRoot, 'apps/mobile/src/entities')
const hadPagesRoot = existsSync(pagesRoot)
const hadEntitiesRoot = existsSync(entitiesRoot)

section('mobile boundary probe')

const writeFile = (path, content) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

let failure = ''
let pageDir = ''
let sliceADir = ''
let sliceBDir = ''

try {
  mkdirSync(pagesRoot, { recursive: true })
  mkdirSync(entitiesRoot, { recursive: true })
  pageDir = mkdtempSync(join(pagesRoot, '__boundary_probe_page_'))
  sliceADir = mkdtempSync(join(entitiesRoot, '__boundary_probe_a_'))
  sliceBDir = mkdtempSync(join(entitiesRoot, '__boundary_probe_b_'))
  const pageSlice = basename(pageDir)
  const sliceA = basename(sliceADir)

  // Slice A exposes a public `@x` and keeps a private `model`.
  writeFile(join(pageDir, 'index.ts'), 'export const boundaryProbePage = true\n')
  writeFile(join(sliceADir, '@x', 'pub.ts'), 'export const aPub = true\n')
  writeFile(join(sliceADir, 'model', 'secret.ts'), 'export const aSecret = true\n')

  // Slice B: two forbidden reaches, one forbidden `@x` reach, and two allowed imports.
  writeFile(join(sliceBDir, 'model', 'secret2.ts'), 'export const bSecret = true\n')
  writeFile(
    join(sliceBDir, 'model', 'to-pages.ts'),
    `import { boundaryProbePage } from '../../../pages/${pageSlice}/index.ts'\nexport const forbiddenToPages = boundaryProbePage\n`,
  )
  writeFile(
    join(sliceBDir, 'model', 'forbidden-model.ts'),
    `import { aSecret } from '../../${sliceA}/model/secret.ts'\nexport const forbiddenModel = aSecret\n`,
  )
  writeFile(
    join(sliceBDir, '@x', 'x-leak.ts'),
    `import { aSecret } from '../../${sliceA}/model/secret.ts'\nexport const forbiddenXLeak = aSecret\n`,
  )
  writeFile(
    join(sliceBDir, 'model', 'allowed-x.ts'),
    `import { aPub } from '../../${sliceA}/@x/pub.ts'\nexport const allowedX = aPub\n`,
  )
  writeFile(
    join(sliceBDir, '@x', 'x-own.ts'),
    `import { bSecret } from '../model/secret2.ts'\nexport const allowedXOwn = bSecret\n`,
  )

  const result = spawnSync('pnpm', ['--filter', '@cosimosi/mobile', 'lint:boundaries'], {
    cwd: repoRoot,
    stdio: 'pipe',
    encoding: 'utf8',
  })
  const output = `${result.stdout}\n${result.stderr}`
  // Match by a path fragment that includes the unique temp-slice dir (mkdtemp suffix), so the
  // assertion can't be fooled by an unrelated real file that happens to share a fixture basename.
  const sliceB = basename(sliceBDir)
  const forbidden = [
    `${sliceB}/model/to-pages.ts`,
    `${sliceB}/model/forbidden-model.ts`,
    `${sliceB}/@x/x-leak.ts`,
  ]
  const allowed = [`${sliceB}/model/allowed-x.ts`, `${sliceB}/@x/x-own.ts`]

  if (result.status === 0) {
    failure = 'boundary probe unexpectedly passed; forbidden cross-boundary imports must fail'
  } else if (!output.includes('boundaries/dependencies')) {
    console.error(output)
    failure = 'boundary probe failed, but not through boundaries/dependencies'
  } else {
    const missed = forbidden.filter((name) => !output.includes(name))
    const leaked = allowed.filter((name) => output.includes(name))
    if (missed.length) {
      console.error(output)
      failure = `forbidden imports were not caught: ${missed.join(', ')}`
    } else if (leaked.length) {
      console.error(output)
      failure = `allowed imports were wrongly flagged: ${leaked.join(', ')}`
    } else {
      ok(
        'entities→pages, entities→other-model, and @x→other-slice fail; entities→@x and @x→own-slice pass',
      )
    }
  }
} finally {
  for (const dir of [pageDir, sliceADir, sliceBDir]) {
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
  if (!hadPagesRoot) {
    try {
      rmdirSync(pagesRoot)
    } catch {}
  }
  if (!hadEntitiesRoot) {
    try {
      rmdirSync(entitiesRoot)
    } catch {}
  }
}

if (failure) fail(failure)
