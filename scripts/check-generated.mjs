#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { fail, ok, pnpm, repoRoot, section } from './lib.mjs'

const generatedPathspecs = [
  'apps/api/internal/gen',
  'apps/api/internal/platform/values/values_gen.go',
  'apps/api/db/gen',
  ':(glob)packages/**/gen/**',
  ':(glob)packages/**/*.gen.ts',
  ':(glob)packages/**/*.gen.tsx',
  ':(glob)packages/**/*.gen.css',
]

const git = (args) => {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (result.error) throw result.error
  if (result.status) fail('git failed while checking generated outputs')
  return result.stdout.trim()
}

const status = () =>
  [
    git(['diff', '--name-only', '--', ...generatedPathspecs]),
    git(['ls-files', '--others', '--exclude-standard', '--', ...generatedPathspecs]),
  ]
    .filter(Boolean)
    .join('\n')

section('generated freshness')
pnpm(['gen'])

const dirty = status()
if (dirty) {
  console.error(dirty)
  fail('generated outputs are stale; run pnpm gen and commit the changed generated files')
}

ok('generated outputs are fresh')
