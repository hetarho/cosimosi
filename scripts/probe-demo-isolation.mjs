#!/usr/bin/env node
// Demo-isolation probe: proves the `src/pages/demo/**` import block actually bites, the way the
// web/mobile boundary probes prove theirs. A lint rule nobody has seen fail is a rule nobody knows is
// wired — and this one is the whole of [I13] for the demo: it is what makes an unauthenticated,
// rule-exempt sandbox unable to reach the real code path rather than merely discouraged from it.
//
// The fixtures live in a hermetic `.probe-ws-*` workspace (see probe-workspace.mjs), mirrored at the
// demo's own path so the path-scoped block applies, and are linted with the app's real ESLint config.
// No production scanner root ever contains them, so a concurrent `pnpm lint`/`check` cannot sweep
// them up (quality-gates §Probe hermeticity).
//
//   node scripts/probe-demo-isolation.mjs

import { join } from 'node:path'

import { fail, ok, repoRoot, section } from './lib.mjs'
import { createProbeWorkspace, createWorkspaceLinter } from './probe-workspace.mjs'

const webRoot = join(repoRoot, 'apps/web')

// Each case is one line the demo must not be able to write, and the reason it closes something.
const forbidden = [
  ["import { createUniverseClient } from '@cosimosi/api-client'", 'the generated clients'],
  ["import { useTransport } from '@connectrpc/connect-query'", 'the only source of a transport'],
  ["import { useUniverse } from '@cosimosi/universe/react'", 'a server-backed read mirror'],
  ["import { writeMoodColor } from '@cosimosi/emotion/react'", 'an AccountService write'],
  ["import { ornamentCost } from '@cosimosi/store'", 'a price table'],
  ["import { useOrnamentCatalog } from '@cosimosi/store/react'", 'the catalog Query seam'],
  ["import { recallCost } from '@cosimosi/twinkle-logic'", 'a cost formula'],
  ["import { StardustOverlay } from '../../../widgets/stardust/index.ts'", 'a currency surface'],
  [
    "import { SpendCostDisplay } from '../../../features/spend-cost-display/index.ts'",
    'a spend gate',
  ],
  ["import { Color } from 'three'", 'the renderer, which the flat-config restate must keep banned'],
]

// And the lines it must still be able to write, or the boundary would have cost the demo its point.
const permitted = [
  "import { DEMO_DIARY_SETS } from '@cosimosi/demo'",
  "import { resolveCaptionPlacement } from '@cosimosi/sequence'",
  "import { useSequenceRun } from '@cosimosi/sequence/react'",
  "import { buildUniverseGraph } from '@cosimosi/universe'",
  "import { StarLayer } from '@cosimosi/universe-render'",
  "import { UniverseCanvas } from '@cosimosi/3d-renderer'",
  "import { applyMoodColors } from '@cosimosi/emotion/react'",
  "import { ornamentName } from '@cosimosi/store/i18n'",
  "import { SequenceGuide } from '../../../widgets/sequence-guide/index.ts'",
  "import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'",
]

const fixtureFile = (index) => `src/pages/demo/probe-${index}.ts`
const restrictedReports = (messages) =>
  (messages ?? []).filter((message) => message.ruleId === 'no-restricted-imports')

section('demo isolation probe')

const workspace = createProbeWorkspace(webRoot)
let failure = ''
try {
  forbidden.forEach(([line], index) => workspace.write(fixtureFile(index), `${line}\n`))
  permitted.forEach((line, index) =>
    workspace.write(fixtureFile(forbidden.length + index), `${line}\n`),
  )

  const linter = await createWorkspaceLinter(workspace, webRoot, join(webRoot, 'eslint.config.js'))
  const reports = await linter.lintFiles(['src/pages/demo/*.ts'])

  const missed = forbidden
    .filter((_, index) => restrictedReports(reports.get(fixtureFile(index))).length === 0)
    .map(([line, why]) => `${line}  (${why})`)
  const blocked = permitted.filter(
    (line, index) =>
      restrictedReports(reports.get(fixtureFile(forbidden.length + index))).length > 0,
  )

  if (missed.length) {
    failure = `the demo block let these through:\n  ${missed.join('\n  ')}`
  } else if (blocked.length) {
    failure = `the demo block wrongly refused these:\n  ${blocked.join('\n  ')}`
  } else {
    ok(
      `${forbidden.length} forbidden import(s) refused, ${permitted.length} permitted import(s) allowed`,
    )
  }
} catch (error) {
  failure = `eslint failed to run on the probe:\n${error.stack ?? error}`
} finally {
  workspace.dispose()
}

if (failure) fail(failure)
