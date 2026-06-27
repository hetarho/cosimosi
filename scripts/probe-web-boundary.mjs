#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, rmSync, rmdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fail, ok, repoRoot, section } from './lib.mjs'

const pagesRoot = join(repoRoot, 'apps/web/src/pages')
const entitiesRoot = join(repoRoot, 'apps/web/src/entities')
const hadPagesRoot = existsSync(pagesRoot)
const hadEntitiesRoot = existsSync(entitiesRoot)

section('web boundary probe')

let failure = ''
let pageDir = ''
let entityRoot = ''

try {
  mkdirSync(pagesRoot, { recursive: true })
  mkdirSync(entitiesRoot, { recursive: true })
  pageDir = mkdtempSync(join(pagesRoot, '__boundary_probe_'))
  const sliceName = basename(pageDir)
  entityRoot = join(entitiesRoot, sliceName)
  const entityDir = join(entityRoot, 'model')
  const pageFile = join(pageDir, 'index.ts')
  const entityFile = join(entityDir, 'probe.ts')

  mkdirSync(pageDir, { recursive: true })
  mkdirSync(entityDir, { recursive: true })
  writeFileSync(pageFile, 'export const boundaryProbePage = true\n', 'utf8')
  writeFileSync(entityFile, `import { boundaryProbePage } from '../../../pages/${sliceName}/index.ts'\nexport const boundaryProbeEntity = boundaryProbePage\n`, 'utf8')

  const result = spawnSync('pnpm', ['--filter', '@cosimosi/web', 'lint:boundaries'], {
    cwd: repoRoot,
    stdio: 'pipe',
    encoding: 'utf8',
  })

  if (result.status === 0) {
    failure = 'boundary probe unexpectedly passed; entities must not import pages'
  } else if (!`${result.stdout}\n${result.stderr}`.includes('boundaries/dependencies')) {
    console.error(result.stdout)
    console.error(result.stderr)
    failure = 'boundary probe failed, but not through boundaries/dependencies'
  } else {
    ok('forbidden entities -> pages import failed as expected')
  }
} finally {
  if (pageDir) rmSync(pageDir, { recursive: true, force: true })
  if (entityRoot) rmSync(entityRoot, { recursive: true, force: true })
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
