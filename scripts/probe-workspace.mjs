// Hermetic fixture workspaces for the negative lint probes (quality-gates §Probe hermeticity).
//
// Every probe plants deliberate rule violations and asserts the real config reports them. Planted
// inside a scanned source root, those fixtures would make the gates non-hermetic: any concurrently
// running ordinary scan (another session's `pnpm lint`/`check`, a husky hook) would sweep them up
// and fail with no code at fault. So fixtures live in a throwaway `.probe-ws-*` directory that no
// production scanner root contains, and the probe lints them with the app's OWN ESLint + config
// through a thin wrapper written into the workspace.
//
// Two placement/anchoring constraints shape this file:
// - The workspace sits under the app root (not the OS temp dir) because config machinery resolves
//   modules from its own location: mobile's eslintrc resolves `extends`/plugins by walking
//   node_modules up from the config file, so the wrapper must sit inside the app's resolution chain.
// - `eslint-plugin-boundaries` matches its element patterns against paths relative to
//   `boundaries/root-path` (default: process.cwd()), so both wrappers pin that setting to the
//   workspace root; ESLint's own `cwd` option does not move process.cwd().
//
// The `.probe-ws-*` name matters: it is gitignored and matches the `**/.probe-*/**` exclusion every
// ordinary scanner carries, so even a live or crashed workspace is invisible outside the probe.

import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const WORKSPACE_PREFIX = '.probe-ws-'
// A crashed probe cannot clean up after itself, so the next run does. Only clearly-abandoned
// workspaces are swept — a younger sibling may belong to a live concurrent probe (even a paused or
// debugged one, hence a full day rather than minutes; leftovers are invisible to every scanner, so
// lingering costs nothing).
const STALE_WORKSPACE_MS = 24 * 60 * 60 * 1000

function sweepStaleWorkspaces(anchorDir) {
  let entries
  try {
    entries = readdirSync(anchorDir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(WORKSPACE_PREFIX)) continue
    const path = join(anchorDir, entry.name)
    try {
      if (Date.now() - statSync(path).mtimeMs > STALE_WORKSPACE_MS) {
        rmSync(path, { recursive: true, force: true })
      }
    } catch {}
  }
}

/** A throwaway fixture tree under `anchorDir`, invisible to every ordinary scanner. */
export function createProbeWorkspace(anchorDir) {
  sweepStaleWorkspaces(anchorDir)
  // realpath because macOS tempdir-style symlinked parents would make ESLint's path matching
  // compare a symlinked cwd against resolved file paths.
  const root = realpathSync(mkdtempSync(join(anchorDir, WORKSPACE_PREFIX)))
  return {
    root,
    write(relPath, content) {
      const path = join(root, relPath)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, content, 'utf8')
      return path
    },
    dispose() {
      rmSync(root, { recursive: true, force: true })
    },
  }
}

/** The ESLint class the app's own gate runs — resolved from `appDir`, never from this script. */
async function loadESLintFrom(appDir) {
  const require_ = createRequire(join(appDir, 'package.json'))
  const mod = await import(pathToFileURL(require_.resolve('eslint')).href)
  return (mod.ESLint ? mod : mod.default).ESLint
}

function writeConfigWrapper(workspace, realConfigPath) {
  // Legacy eslintrc vs flat config need different wrapper formats AND different ESLint options;
  // the config's own filename is the discriminator, so a future app migration flips this
  // automatically when the probe starts passing the new config path.
  if (basename(realConfigPath).startsWith('.eslintrc')) {
    return {
      legacy: true,
      path: workspace.write(
        '.eslintrc.cjs',
        `const base = require(${JSON.stringify(realConfigPath)})\n` +
          `module.exports = { ...base, settings: { ...base.settings, 'boundaries/root-path': ${JSON.stringify(workspace.root)} } }\n`,
      ),
    }
  }
  return {
    legacy: false,
    path: workspace.write(
      'eslint.config.mjs',
      `import config from ${JSON.stringify(pathToFileURL(realConfigPath).href)}\n` +
        `export default [...config, { settings: { 'boundaries/root-path': ${JSON.stringify(workspace.root)} } }]\n`,
    ),
  }
}

/**
 * Lint workspace fixtures with the real config at `realConfigPath`, using the ESLint installed for
 * `appDir` (the same one the ordinary gate runs). Returns `lintFiles(patterns)` resolving to
 * `Map<workspace-relative posix path, messages[]>`.
 */
export async function createWorkspaceLinter(workspace, appDir, realConfigPath) {
  const ESLint = await loadESLintFrom(appDir)
  const wrapper = writeConfigWrapper(workspace, realConfigPath)
  const eslint = new ESLint({
    cwd: workspace.root,
    overrideConfigFile: wrapper.path,
    // Flat-config ESLint rejects unknown options, so the eslintrc-only switch is conditional.
    ...(wrapper.legacy ? { useEslintrc: false } : {}),
  })
  return {
    async lintFiles(patterns) {
      const results = await eslint.lintFiles(patterns)
      return new Map(
        results.map((result) => [
          result.filePath.slice(workspace.root.length + 1).replaceAll('\\', '/'),
          result.messages,
        ]),
      )
    },
  }
}
