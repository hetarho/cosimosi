#!/usr/bin/env node
import { join } from 'node:path'

import { fail, ok, repoRoot, section } from './lib.mjs'
import { runBoundaryProbe } from './probe-boundary.mjs'
import { createProbeWorkspace, createWorkspaceLinter } from './probe-workspace.mjs'

await runBoundaryProbe({
  name: 'mobile',
  config: '.eslintrc.js',
  // mobile's boundary coverage rides `lint`'s whole-app `eslint .` pass.
  ordinaryScan: [['lint', 'eslint . --max-warnings=0']],
})

await runI18nSeamProbe()

async function runI18nSeamProbe() {
  const appRoot = join(repoRoot, 'apps/mobile')
  const workspace = createProbeWorkspace(appRoot)
  const offender = 'src/pages/probe-i18n/ui/offender.ts'
  const allowed = [
    'src/shared/i18n/index.ts',
    'src/shared/native/locale-storage.ts',
    'src/pages/probe-i18n/ui/allowed.test.ts',
  ]

  section('mobile i18n seam probe')
  let failure = ''
  try {
    for (const file of [offender, ...allowed]) {
      workspace.write(file, "import { m } from '@cosimosi/i18n'\nexport const probe = m\n")
    }
    const linter = await createWorkspaceLinter(workspace, appRoot, join(appRoot, '.eslintrc.js'))
    const reports = await linter.lintFiles([offender, ...allowed])
    const restricted = (file) =>
      (reports.get(file) ?? []).filter((message) => message.ruleId === 'no-restricted-imports')
    const missed = restricted(offender).length === 0
    const leaked = allowed.filter((file) => restricted(file).length > 0)

    if (missed || leaked.length) {
      for (const [file, messages] of reports) {
        console.error(`  ${file}: ${messages.map((m) => `${m.ruleId}: ${m.message}`).join(' | ')}`)
      }
      failure = missed
        ? 'a production direct @cosimosi/i18n import was not rejected'
        : `allowed direct imports were rejected: ${leaked.join(', ')}`
    } else {
      ok('production imports fail; the app barrel, locale adapter, and test file pass')
    }
  } catch (error) {
    failure = `eslint failed to run on the i18n probe:\n${error.stack ?? error}`
  } finally {
    workspace.dispose()
  }

  if (failure) fail(failure)
}
