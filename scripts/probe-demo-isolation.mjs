#!/usr/bin/env node
// Demo-isolation probe: proves the `src/pages/demo/**` import block actually bites, the way the
// web/mobile boundary probes prove theirs. A lint rule nobody has seen fail is a rule nobody knows is
// wired — and this one is the whole of [I13] for the demo: it is what makes an unauthenticated,
// rule-exempt sandbox unable to reach the real code path rather than merely discouraged from it.
//
// It writes throwaway files under apps/web/src/pages/demo, runs ESLint on them, and asserts each
// forbidden import is reported and each permitted one is not. The files are removed either way.
//
//   node scripts/probe-demo-isolation.mjs

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'

import { fail, ok, repoRoot, section } from './lib.mjs'

const webRoot = join(repoRoot, 'apps/web')
const probeDir = mkdtempSync(join(webRoot, 'src/pages/demo/.probe-'))

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

function lintLine(line, index) {
  const file = join(probeDir, `probe-${index}.ts`)
  writeFileSync(file, `${line}\n`)
  try {
    execFileSync('npx', ['eslint', '--no-ignore', '--format', 'json', relative(webRoot, file)], {
      cwd: webRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return []
  } catch (error) {
    const stdout = error.stdout ?? ''
    if (!stdout.trim().startsWith('['))
      fail(`eslint failed to run on the probe:\n${stdout}\n${error.stderr ?? ''}`)
    const [result] = JSON.parse(stdout)
    return (result?.messages ?? []).filter((message) => message.ruleId === 'no-restricted-imports')
  }
}

section('demo isolation probe')
try {
  const missed = []
  forbidden.forEach(([line, why], index) => {
    if (lintLine(line, index).length === 0) missed.push(`${line}  (${why})`)
  })

  const blocked = []
  permitted.forEach((line, index) => {
    if (lintLine(line, forbidden.length + index).length > 0) blocked.push(line)
  })

  if (missed.length) {
    fail(`the demo block let these through:\n  ${missed.join('\n  ')}`)
  }
  if (blocked.length) {
    fail(`the demo block wrongly refused these:\n  ${blocked.join('\n  ')}`)
  }
  ok(
    `${forbidden.length} forbidden import(s) refused, ${permitted.length} permitted import(s) allowed`,
  )
} finally {
  rmSync(probeDir, { recursive: true, force: true })
}
