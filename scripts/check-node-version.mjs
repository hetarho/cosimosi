#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fail, ok, repoRoot, section } from './lib.mjs'

const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
const required = parseMinimumNode(packageJson.engines?.node)
const current = process.versions.node.split('.').map((part) => Number(part))

section('node version')

if (!required) {
  fail('package.json engines.node must declare a minimum Node version')
}

if (compareSemver(current, required) < 0) {
  fail(`Node ${process.versions.node} is unsupported; use Node >=${required.join('.')}`)
}

ok(`Node ${process.versions.node} satisfies >=${required.join('.')}`)

function parseMinimumNode(range) {
  const match = typeof range === 'string' ? range.match(/>=\s*(\d+)\.(\d+)(?:\.(\d+))?/) : null
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)]
}

function compareSemver(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}
