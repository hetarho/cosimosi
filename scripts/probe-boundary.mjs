// Shared body of the web/mobile FSD boundary probes. Each app's probe proves the boundary rules in
// ITS config actually fire — a green `eslint` config could silently stop enforcing them. The two
// configs are different mechanisms (web: flat, mobile: eslintrc), so each app keeps its own probe
// entry and neither passing says anything about the other.
//
// Fixture slices are planted in a hermetic `.probe-ws-*` workspace (see probe-workspace.mjs) laid
// out like the app's `src/`, and linted with the app's own ESLint + config. No production scanner
// root ever contains them, so a concurrent `pnpm lint`/`check` cannot sweep them up (quality-gates
// §Probe hermeticity). Cases cover layer direction and the `@x` anti-corruption seam:
//   FORBIDDEN  entities → pages                          (layer direction)
//   FORBIDDEN  entities → another entity's private model (no same-layer reach past `@x`)
//   FORBIDDEN  an `@x` file → another slice's model      (`@x` reaches only its OWN slice)
//   ALLOWED    entities → another entity's `@x`          (the sanctioned same-layer cross-import)
//   ALLOWED    an `@x` file → its OWN slice's model

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { fail, ok, repoRoot, section } from './lib.mjs'
import { createProbeWorkspace, createWorkspaceLinter } from './probe-workspace.mjs'

const boundaryReports = (messages) =>
  (messages ?? []).filter((message) => message.ruleId === 'boundaries/dependencies')

// The workspace lint proves the RULES fire; this proves the ordinary gate still routes the real
// tree into them. Without it, a narrowed scan glob (or a gate that stops invoking the scan) would
// leave the probe green while boundary violations in real slices go unscanned. A drift here means:
// change the gate wiring and this expectation together, consciously.
function wiringDrift(appRoot, expectations) {
  const { scripts = {} } = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'))
  return expectations
    .filter(([script, needle]) => !scripts[script]?.includes(needle))
    .map(
      ([script, needle]) =>
        `package.json script "${script}" no longer carries "${needle}" — the ordinary gate stopped routing files into the rules this probe certifies`,
    )
}

export async function runBoundaryProbe({ name, config, ordinaryScan }) {
  const appRoot = join(repoRoot, `apps/${name}`)

  section(`${name} boundary probe`)

  const drift = wiringDrift(appRoot, ordinaryScan)
  if (drift.length) fail(drift.join('\n  '))

  const workspace = createProbeWorkspace(appRoot)
  let failure = ''
  try {
    // Slice A exposes a public `@x` and keeps a private `model`.
    workspace.write('src/pages/probe-page/index.ts', 'export const boundaryProbePage = true\n')
    workspace.write('src/entities/probe-a/@x/pub.ts', 'export const aPub = true\n')
    workspace.write('src/entities/probe-a/model/secret.ts', 'export const aSecret = true\n')

    // Slice B: two forbidden reaches, one forbidden `@x` reach, and two allowed imports.
    workspace.write('src/entities/probe-b/model/secret2.ts', 'export const bSecret = true\n')
    workspace.write(
      'src/entities/probe-b/model/to-pages.ts',
      "import { boundaryProbePage } from '../../../pages/probe-page/index.ts'\nexport const forbiddenToPages = boundaryProbePage\n",
    )
    workspace.write(
      'src/entities/probe-b/model/forbidden-model.ts',
      "import { aSecret } from '../../probe-a/model/secret.ts'\nexport const forbiddenModel = aSecret\n",
    )
    workspace.write(
      'src/entities/probe-b/@x/x-leak.ts',
      "import { aSecret } from '../../probe-a/model/secret.ts'\nexport const forbiddenXLeak = aSecret\n",
    )
    workspace.write(
      'src/entities/probe-b/model/allowed-x.ts',
      "import { aPub } from '../../probe-a/@x/pub.ts'\nexport const allowedX = aPub\n",
    )
    workspace.write(
      'src/entities/probe-b/@x/x-own.ts',
      "import { bSecret } from '../model/secret2.ts'\nexport const allowedXOwn = bSecret\n",
    )

    const forbidden = [
      'src/entities/probe-b/model/to-pages.ts',
      'src/entities/probe-b/model/forbidden-model.ts',
      'src/entities/probe-b/@x/x-leak.ts',
    ]
    const allowed = ['src/entities/probe-b/model/allowed-x.ts', 'src/entities/probe-b/@x/x-own.ts']

    const linter = await createWorkspaceLinter(workspace, appRoot, join(appRoot, config))
    const reports = await linter.lintFiles(['src/**/*.ts'])

    const missed = forbidden.filter((file) => boundaryReports(reports.get(file)).length === 0)
    const leaked = allowed.filter((file) => boundaryReports(reports.get(file)).length > 0)

    if (missed.length || leaked.length) {
      for (const [file, messages] of reports) {
        console.error(`  ${file}: ${messages.map((m) => `${m.ruleId}: ${m.message}`).join(' | ')}`)
      }
      failure = missed.length
        ? `forbidden imports were not caught through boundaries/dependencies: ${missed.join(', ')}`
        : `allowed imports were wrongly flagged: ${leaked.join(', ')}`
    } else {
      ok(
        'entities→pages, entities→other-model, and @x→other-slice fail; entities→@x and @x→own-slice pass',
      )
    }
  } catch (error) {
    failure = `eslint failed to run on the probe:\n${error.stack ?? error}`
  } finally {
    workspace.dispose()
  }

  if (failure) fail(failure)
}
