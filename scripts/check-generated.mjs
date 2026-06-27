#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { fail, ok, pnpm, repoRoot, section } from './lib.mjs'

const generatedPathspecs = [
  'apps/api/internal/gen',
  'apps/api/internal/values/values_gen.go',
  'apps/api/db/gen',
  'apps/web/src/shared/api/gen',
  'apps/web/src/shared/config/values.gen.ts',
  ':(glob)packages/**/gen/**',
  ':(glob)packages/**/*.gen.ts',
  ':(glob)packages/**/*.gen.tsx',
]

const status = () => {
  const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ...generatedPathspecs], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (result.error) throw result.error
  if (result.status) fail('git status failed while checking generated outputs')
  return result.stdout.trim()
}

section('generated freshness')
pnpm(['gen'])

const dirty = status()
if (dirty) {
  console.error(dirty)
  fail('generated outputs are stale; run pnpm gen and commit the changed generated files')
}

ok('generated outputs are fresh')
