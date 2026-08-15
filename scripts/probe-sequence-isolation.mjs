#!/usr/bin/env node
// Sequence-isolation probe: proves the `features/**` + `entities/**` import block bites in BOTH apps,
// the way the demo-isolation and boundary probes prove theirs. A lint rule nobody has seen fail is a
// rule nobody knows is wired — and this one is what keeps "no product slice learns that a tour exists"
// structural instead of a review habit. Anchors are registered by wrapping an existing child at a
// composition site (a page or a widget); a slice that could import the engine could register one from
// inside a shipped product feature, and the demo's exemptions would have a path into real code.
//
// The fixtures live in a per-app hermetic `.probe-ws-*` workspace (see probe-workspace.mjs), mirrored
// at the product/chrome slice paths so each app's path-scoped rules apply, and are linted with that
// app's own ESLint + config. No production scanner root ever contains them, so a concurrent
// `pnpm lint`/`check` cannot sweep them up (quality-gates §Probe hermeticity).
//
//   node scripts/probe-sequence-isolation.mjs

import { join } from 'node:path'

import { fail, ok, repoRoot, section } from './lib.mjs'
import { createProbeWorkspace, createWorkspaceLinter } from './probe-workspace.mjs'

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
  { name: 'web', root: join(repoRoot, 'apps/web'), config: 'eslint.config.js' },
  { name: 'mobile', root: join(repoRoot, 'apps/mobile'), config: '.eslintrc.js' },
]

const restrictedReports = (messages) =>
  (messages ?? []).filter((message) => message.ruleId === 'no-restricted-imports')

section('sequence isolation probe')

let failure = ''
let checked = 0
for (const app of apps) {
  const workspace = createProbeWorkspace(app.root)
  try {
    let index = 0
    const fixture = (slice, line) => {
      const path = `${slice}/probe-${index++}.ts`
      workspace.write(path, `${line}\n`)
      return path
    }
    const forbiddenFiles = forbidden.map((line) => [fixture(PRODUCT_SLICE, line), line])
    const exemptFiles = exemptSlices.map(({ slice, permitted }) => ({
      slice,
      files: permitted.map((line) => [fixture(slice, line), line]),
    }))

    const linter = await createWorkspaceLinter(workspace, app.root, join(app.root, app.config))
    const reports = await linter.lintFiles(['src/features/**/probe-*.ts'])

    const missed = forbiddenFiles
      .filter(([path]) => restrictedReports(reports.get(path)).length === 0)
      .map(([, line]) => line)
    if (missed.length) {
      failure = `the ${app.name} product-slice block let these through:\n  ${missed.join('\n  ')}`
      break
    }
    checked += forbidden.length

    for (const { slice, files } of exemptFiles) {
      const blocked = files
        .filter(([path]) => restrictedReports(reports.get(path)).length > 0)
        .map(([, line]) => line)
      if (blocked.length) {
        failure = `${app.name}'s ${slice} exemption wrongly refused:\n  ${blocked.join('\n  ')}`
        break
      }
      checked += files.length
    }
    if (failure) break
  } catch (error) {
    failure = `eslint failed to run on the ${app.name} probe:\n${error.stack ?? error}`
    break
  } finally {
    workspace.dispose()
  }
}

if (failure) fail(failure)
ok(
  `${checked} import(s) checked across ${apps.length} app(s): product slices refused, chrome allowed`,
)
