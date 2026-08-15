// Probe hermeticity regression (quality-gates §Probe hermeticity): overlapping gate invocations
// must not fail each other.
//
// The negative lint probes plant deliberate rule violations. Planted inside scanned source roots,
// those fixtures would let any concurrently running ordinary scan (another session's
// `pnpm lint`/`check`, a husky hook racing a manual run) sweep them up and fail with no code at
// fault. So the probes write only into hermetic `.probe-ws-*` workspaces (probe-workspace.mjs), and
// every ordinary scanner additionally excludes the probe-fixture name patterns, so even a crashed
// probe's leftovers cannot fail an unrelated run. Both halves are asserted here.

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

import { repoRoot } from './lib.mjs'

// pnpm is a .cmd shim on Windows → libuv can't exec it directly; go via cmd /c (same as lib.mjs).
function run(cmd, args) {
  const [file, argv] =
    process.platform === 'win32' && cmd !== 'node' ? ['cmd', ['/c', cmd, ...args]] : [cmd, args]
  return new Promise((resolve) => {
    const child = spawn(file, argv, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk) => (output += chunk))
    child.stderr.on('data', (chunk) => (output += chunk))
    child.on('close', (status) => resolve({ status, output }))
  })
}

const label = (cmd, args) => `${cmd} ${args.join(' ')}`

test('a probe run and an ordinary lint scan overlap without failing each other', async () => {
  // The demo probe races the web oxlint sweep — the sweep that covers the root a non-hermetic demo
  // probe would plant fixtures in. Spawned together so their windows overlap; with hermetic
  // fixtures any interleaving must leave both green.
  const probeArgs = ['scripts/probe-demo-isolation.mjs']
  const lintArgs = ['--filter', '@cosimosi/web', 'run', 'lint:ox']
  const [probe, lint] = await Promise.all([run('node', probeArgs), run('pnpm', lintArgs)])
  assert.equal(probe.status, 0, `${label('node', probeArgs)}\n${probe.output}`)
  assert.equal(lint.status, 0, `${label('pnpm', lintArgs)}\n${lint.output}`)
})

test('probe-fixture leftovers inside scanned roots are invisible to every ordinary scanner', async () => {
  // Plant every leftover shape a crashed or live probe can put on disk, each holding a file some
  // scanner rejects when it can see it. Every ordinary scan must stay green while they exist —
  // that is the exclusion each scanner config carries. Non-probe-named violations in the same
  // roots still fail these scans (the probes themselves assert that), so the exclusions stay
  // narrow.
  //
  //   `.probe-*` under scanned roots  — unused var + unformatted (oxlint/eslint/prettier reject)
  //   `__boundary_probe_*` under src  — unformatted only: this is the one non-dot shape, so tsc
  //                                     can see it and its content must stay tsc-clean
  //   `.probe-ws-*` at the app root   — a live workspace: unused var (the oxlint sweep covers the
  //                                     whole app dir, not just src)
  const parents = [
    'apps/web/src/pages/demo',
    'apps/mobile/src/features/write-diary',
    'packages/memory-logic/src',
  ]
  const planted = parents.map((parent) => mkdtempSync(join(repoRoot, parent, '.probe-')))
  const UNUSED_VAR = 'export function probeLeftover() {\n  const leftover = 1\n}\n'
  const boundaryShape = mkdtempSync(join(repoRoot, 'apps/web/src/entities/__boundary_probe_'))
  const workspaceShape = mkdtempSync(join(repoRoot, 'apps/web/.probe-ws-'))
  try {
    for (const dir of planted) writeFileSync(join(dir, 'leftover.ts'), 'const leftover=1\n')
    const nested = [
      [join(boundaryShape, 'model/leftover.ts'), 'export const leftover=1\n'],
      [join(workspaceShape, 'src/pages/demo/leftover.ts'), UNUSED_VAR],
    ]
    for (const [file, content] of nested) {
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, content)
    }

    const scans = [
      ['pnpm', ['--filter', '@cosimosi/web', 'run', 'lint:ox']],
      ['pnpm', ['--filter', '@cosimosi/web', 'exec', 'steiger', './src', '--fail-on-warnings']],
      [
        'pnpm',
        [
          '--filter',
          '@cosimosi/web',
          'exec',
          'eslint',
          'src/pages/demo/**/*.ts',
          '--max-warnings=0',
        ],
      ],
      [
        'pnpm',
        [
          '--filter',
          '@cosimosi/mobile',
          'exec',
          'eslint',
          'src/features/write-diary/**/*.ts',
          '--max-warnings=0',
        ],
      ],
      [
        'pnpm',
        [
          'exec',
          'eslint',
          '--config',
          'eslint.config.packages.mjs',
          'packages/memory-logic/src/**/*.ts',
          '--max-warnings=0',
        ],
      ],
      ['pnpm', ['exec', 'prettier', '--check', ...parents, 'apps/web/src/entities']],
      ['node', ['scripts/lint-fsd-layout.mjs']],
    ]
    const results = await Promise.all(scans.map(([cmd, args]) => run(cmd, args)))
    for (const [index, [cmd, args]] of scans.entries()) {
      assert.equal(results[index].status, 0, `${label(cmd, args)}\n${results[index].output}`)
    }
  } finally {
    for (const dir of [...planted, boundaryShape, workspaceShape]) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})
