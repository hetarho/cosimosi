#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fail, note, ok, repoRoot, section } from './lib.mjs'

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

// `.node-version` is the exact version CI installs (actions/setup-node). It is a
// reproducibility pin, not a local hard requirement — local dev may run any version at or
// above the floor. The gate keeps the pin and the floor from drifting apart: a pin below
// the declared minimum is a config bug.
const pinPath = join(repoRoot, '.node-version')
if (existsSync(pinPath)) {
  const pin = readFileSync(pinPath, 'utf8').trim()
  const pinParts = pin.split('.').map((part) => Number(part))
  if (pinParts.some((part) => Number.isNaN(part))) {
    fail(`.node-version is not a plain version string: "${pin}"`)
  }
  if (compareSemver(pinParts, required) < 0) {
    fail(`.node-version (${pin}) is below the declared engines floor >=${required.join('.')}`)
  }
  note(`.node-version pins ${pin} (CI installs this); any local Node >=${required.join('.')} is fine`)
}

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
