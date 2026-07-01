#!/usr/bin/env node
// FSD structural layout lint — the ARCHITECTURE §3.1 rules that steiger + eslint-plugin-boundaries do NOT cover.
//
// Why this exists: steiger enforces slices/public-API and boundaries enforces one-way imports, but neither checks how
// the non-sliced `app` layer is organized, nor how files inside a slice are grouped. That gap let apps/web/src/app
// drift into a flat pile of provider files while apps/mobile/src/app was segmented — a documented rule (§3.1) that no
// gate enforced. This script closes it, for BOTH apps (so the app layer stays at web↔mobile parity):
//
//   R1  The `app` layer is segmented, not flat. Only the entrypoint + global style + barrel may sit at the app root;
//       providers/router/app-model go in segments (app/providers, app/routes|navigation, app/model, app/styles).
//   R2  Files are grouped by technical ROLE, never by generic TYPE — no components/ hooks/ utils/ helpers/ types/
//       constants/ folder anywhere under apps/*/src (§3.1: use ui/model/api/lib/config).

import { existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { repoRoot, section, ok, note, fail } from './lib.mjs'

const APPS = ['apps/web', 'apps/mobile']
// The only files allowed to sit flat at the app-layer root (the entrypoint, global style, barrel, co-located tests).
const APP_ROOT_ALLOW = new Set(['App.tsx', 'App.test.tsx', 'main.tsx', 'main.test.tsx', 'index.css', 'index.ts'])
const CODE_EXT = /\.(ts|tsx|js|jsx|css)$/
const GENERIC_SEGMENTS = new Set(['components', 'hooks', 'utils', 'helpers', 'types', 'constants', 'misc'])

const problems = []

section('FSD structural layout — app-layer segments + role-not-type (ARCHITECTURE §3.1)')

for (const app of APPS) {
  const srcAbs = join(repoRoot, app, 'src')
  if (!existsSync(srcAbs)) continue

  // R1 — the app layer must be segmented, not a pile of loose files.
  const appAbs = join(srcAbs, 'app')
  if (existsSync(appAbs)) {
    const segments = []
    for (const entry of readdirSync(appAbs, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        segments.push(entry.name)
      } else if (CODE_EXT.test(entry.name) && !APP_ROOT_ALLOW.has(entry.name)) {
        problems.push(
          `${app}/src/app/${entry.name} — loose file in the app layer. Move it into a segment ` +
            `(app/providers · app/routes|navigation · app/model · app/styles). Only ` +
            `[${[...APP_ROOT_ALLOW].join(', ')}] may sit at the app root.`,
        )
      }
    }
    note(`${app}/src/app segments: ${segments.length ? segments.sort().join(', ') : '(none — app layer is flat!)'}`)
  }

  // R2 — no generic-type folders anywhere under src (group by role, not type).
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      if (GENERIC_SEGMENTS.has(entry.name)) {
        problems.push(
          `${relative(repoRoot, join(dir, entry.name))} — generic '${entry.name}/' folder. ` +
            `FSD groups by technical role (ui/model/api/lib/config), not by type.`,
        )
      }
      walk(join(dir, entry.name))
    }
  }
  walk(srcAbs)
}

if (problems.length) {
  for (const p of problems) console.error(`  \x1b[31m✗\x1b[0m ${p}`)
  fail(`${problems.length} FSD layout violation(s). See ARCHITECTURE.md §3.1 (the app layer is segmented; group by role).`)
}

ok('app layers are segmented; no generic-type folders')
