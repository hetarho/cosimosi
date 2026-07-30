#!/usr/bin/env node
// Sequence-isolation probe: proves the `features/**` + `entities/**` import block bites in BOTH apps,
// the way the demo-isolation and boundary probes prove theirs. A lint rule nobody has seen fail is a
// rule nobody knows is wired — and this one is what keeps "no product slice learns that a tour exists"
// structural instead of a review habit. Anchors are registered by wrapping an existing child at a
// composition site (a page or a widget); a slice that could import the engine could register one from
// inside a shipped product feature, and the demo's exemptions would have a path into real code.
//
// It writes throwaway files into a product slice and into an exempt chrome slice in each app, runs that
// app's own ESLint on them, and asserts the forbidden imports are reported and the exempt ones are not.
// The files are removed either way.
//
//   node scripts/probe-sequence-isolation.mjs

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'

import { fail, ok, repoRoot, section } from './lib.mjs'

const forbidden = [
  "import { sequenceRunMachine } from '@cosimosi/sequence'",
  "import { useSequenceRun } from '@cosimosi/sequence/react'",
  "import { ONBOARDING_SCRIPT } from '@cosimosi/onboarding'",
  "import { reportSequenceSignal } from '@cosimosi/onboarding'",
]

// The exempt slices ARE the sequence's own surface, and each must keep reaching what it needs or the
// boundary would have cost the sequence the surface it exists to draw.
const exemptSlices = [
  {
    slice: 'src/features/highlight-next-control',
    permitted: [
      "import { resolveCaptionPlacement } from '@cosimosi/sequence'",
      "import { useSequenceAnchorRegistration } from '@cosimosi/sequence/react'",
    ],
  },
  {
    slice: 'src/features/replay-onboarding',
    permitted: ["import { requestOnboardingReplay } from '@cosimosi/onboarding'"],
  },
]

// Each app is linted by its OWN config — web's flat config and mobile's eslintrc are two different
// mechanisms for the same rule, so one passing says nothing about the other.
const PRODUCT_SLICE = 'src/features/write-diary'
const apps = [
  { name: 'web', root: join(repoRoot, 'apps/web') },
  { name: 'mobile', root: join(repoRoot, 'apps/mobile') },
]

function restrictedImportReports(app, dir, line, index) {
  const file = join(dir, `probe-${index}.ts`)
  writeFileSync(file, `${line}\n`)
  try {
    execFileSync('npx', ['eslint', '--no-ignore', '--format', 'json', relative(app.root, file)], {
      cwd: app.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return []
  } catch (error) {
    const stdout = error.stdout ?? ''
    if (!stdout.trim().startsWith('['))
      fail(`eslint failed to run on the ${app.name} probe:\n${stdout}\n${error.stderr ?? ''}`)
    const [result] = JSON.parse(stdout)
    return (result?.messages ?? []).filter((message) => message.ruleId === 'no-restricted-imports')
  }
}

section('sequence isolation probe')
let checked = 0
for (const app of apps) {
  const dirs = [PRODUCT_SLICE, ...exemptSlices.map(({ slice }) => slice)].map((slice) =>
    mkdtempSync(join(app.root, slice, '.probe-')),
  )
  const [productDir, ...exemptDirs] = dirs
  let index = 0
  try {
    const missed = forbidden.filter(
      (line) => restrictedImportReports(app, productDir, line, index++).length === 0,
    )
    if (missed.length) {
      fail(`the ${app.name} product-slice block let these through:\n  ${missed.join('\n  ')}`)
    }
    checked += forbidden.length

    for (const [position, { slice, permitted }] of exemptSlices.entries()) {
      const blocked = permitted.filter(
        (line) => restrictedImportReports(app, exemptDirs[position], line, index++).length > 0,
      )
      if (blocked.length) {
        fail(`${app.name}'s ${slice} exemption wrongly refused:\n  ${blocked.join('\n  ')}`)
      }
      checked += permitted.length
    }
  } finally {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  }
}
ok(
  `${checked} import(s) checked across ${apps.length} app(s): product slices refused, chrome allowed`,
)
