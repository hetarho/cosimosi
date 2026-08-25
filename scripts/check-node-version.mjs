#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
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
  note(
    `.node-version pins ${pin} (CI installs this); any local Node >=${required.join('.')} is fine`,
  )
}

// The neighbouring drift, and the one with the misleading symptom: a tree installed before a
// dependency was added still typechecks its way to `TS2307: Cannot find module` on a package whose
// dependency IS declared and IS locked. That reads as a broken tsconfig or exports map, not as a
// stale install, and it is the first thing anyone hits after pulling a change that adds a workspace
// dependency. Checked here so it fires before any compiler can produce the confusing error.
//
// Compares declared workspace links against what exists on disk — no network, no lockfile parse.
function checkWorkspaceLinks() {
  const workspaceFile = join(repoRoot, 'pnpm-workspace.yaml')
  if (!existsSync(workspaceFile)) return
  const missing = []
  for (const pkgDir of workspacePackageDirs()) {
    const manifestPath = join(pkgDir, 'package.json')
    if (!existsSync(manifestPath)) continue
    let manifest
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    } catch {
      continue
    }
    const deps = { ...manifest.dependencies, ...manifest.devDependencies }
    for (const [name, range] of Object.entries(deps)) {
      if (typeof range !== 'string' || !range.startsWith('workspace:')) continue
      if (!existsSync(join(pkgDir, 'node_modules', ...name.split('/')))) {
        missing.push(`${manifest.name ?? relative(repoRoot, pkgDir)} → ${name}`)
      }
    }
  }
  if (missing.length > 0) {
    console.error(
      missing
        .map((entry) => `  \x1b[31m✗\x1b[0m ${entry} is declared but not installed`)
        .join('\n'),
    )
    fail('the installed tree is behind package.json — run `pnpm install`')
  }
  note('declared workspace links are installed')
}

function* workspacePackageDirs() {
  for (const group of ['apps', 'packages']) {
    const groupDir = join(repoRoot, group)
    if (!existsSync(groupDir)) continue
    for (const entry of readdirSync(groupDir, { withFileTypes: true })) {
      if (entry.isDirectory()) yield join(groupDir, entry.name)
    }
  }
}

checkWorkspaceLinks()

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
