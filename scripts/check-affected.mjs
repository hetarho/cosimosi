#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

import { repoRoot, subprocessExitCode } from './lib.mjs'

function options(args) {
  let mode
  let base
  let list = false
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--') continue
    if (argument === '--list') list = true
    else if (argument === '--base') {
      if (base !== undefined || !args[index + 1] || args[index + 1].startsWith('--'))
        throw new Error('--base requires one commit or ref')
      base = args[++index]
    } else if (['typecheck', 'test', 'list'].includes(argument) && !mode) mode = argument
    else throw new Error(`Unknown affected-check argument: ${argument}`)
  }
  if (!mode && list) mode = 'list'
  if (!mode)
    throw new Error('Usage: check-affected.mjs typecheck|test|list [--base <ref>] [--list]')
  return {
    mode,
    list: list || mode === 'list',
    base: base ?? (process.env.HAERAM_DIFF_BASE || 'HEAD'),
  }
}

function command(file, args, cwd, capture = true) {
  const result = spawnSync(file, args, {
    cwd,
    shell: false,
    ...(capture ? { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 } : { stdio: 'inherit' }),
  })
  if (result.error) throw result.error
  const status = subprocessExitCode(result)
  if (capture && status)
    throw new Error(`${file} failed (${result.signal ?? status}): ${result.stderr.trim()}`)
  return capture ? result.stdout : status
}

function pnpm(args, cwd, capture = true) {
  return process.platform === 'win32'
    ? command('cmd', ['/c', 'pnpm', ...args], cwd, capture)
    : command('pnpm', args, cwd, capture)
}

function inside(root, path) {
  const local = relative(root, path)
  return local === '' || (!isAbsolute(local) && local !== '..' && !local.startsWith(`..${sep}`))
}

function inventory(text, workspaceRoot) {
  const values = JSON.parse(text)
  if (!Array.isArray(values)) throw new Error('Workspace inventory must be an array')
  const names = new Set()
  const paths = new Set()
  return values.map((value) => {
    if (
      !value ||
      typeof value.name !== 'string' ||
      !value.name ||
      /[\s*?{}\[\]!^\\]/.test(value.name) ||
      value.name.includes('...') ||
      typeof value.path !== 'string' ||
      !isAbsolute(value.path)
    )
      throw new Error('Workspace inventory contains an unnamed or ambiguous project')
    const path = realpathSync(value.path)
    if (!inside(workspaceRoot, path) || !existsSync(join(path, 'package.json')))
      throw new Error(
        'Workspace inventory contains a project outside this workspace or without a manifest',
      )
    if (names.has(value.name) || paths.has(path))
      throw new Error('Workspace inventory contains duplicate names or paths')
    names.add(value.name)
    paths.add(path)
    return { name: value.name, path }
  })
}

const SHARED_FILES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.npmrc',
  '.node-version',
  'spec/values.yaml',
  'packages/ui/src/tokens.ts',
])
const sharedInput = (path) =>
  SHARED_FILES.has(path) ||
  path.startsWith('proto/') ||
  path.startsWith('apps/api/db/') ||
  path.startsWith('packages/i18n/messages/')

const GUARD_FILES = new Set([
  'scripts/check-affected.mjs',
  'scripts/check-affected.test.mjs',
  'scripts/check-error-reasons.mjs',
  'scripts/check-generated.mjs',
  'scripts/check-node-version.mjs',
  'scripts/check-observability-boundaries.mjs',
  'scripts/check-package-entries.mjs',
  'scripts/check-package-entries.test.mjs',
  'scripts/check-persistence-isolation.mjs',
  'scripts/check-persistence-isolation.test.mjs',
  'scripts/check-spec-hygiene.mjs',
  'scripts/check-test-reachability.mjs',
  'scripts/go-check.mjs',
  'scripts/lint-comment-history.mjs',
  'scripts/lint-fsd-layout.mjs',
  'scripts/lint-fsd-layout.test.mjs',
  'scripts/lint-public-copy.mjs',
  'scripts/lint-raw-strings.mjs',
  'scripts/lint-style-escapes.mjs',
  'scripts/lint-ubiquitous-language.mjs',
  'scripts/probe-boundary.mjs',
  'scripts/probe-demo-isolation.mjs',
  'scripts/probe-hermeticity.test.mjs',
  'scripts/probe-mobile-boundary.mjs',
  'scripts/probe-packages-lint.mjs',
  'scripts/probe-sequence-isolation.mjs',
  'scripts/probe-web-boundary.mjs',
  'scripts/probe-workspace.mjs',
  'scripts/subprocess-results.test.mjs',
  'scripts/slice-api-parity.test.mjs',
  'scripts/user-state-registry.test.mjs',
])

// These locations contain no workspace implementation. Unrecognized paths retain all checks;
// in particular, spec/values.yaml and Markdown inside a workspace are not documentation exemptions.
function outsideKind(path) {
  if (
    [
      'README.md',
      'DEPLOY.md',
      'CLAUDE.md',
      'AGENTS.md',
      'spec/FORMAT.md',
      'spec/STATE.md',
      'spec/NARRATIVE.md',
    ].includes(path) ||
    /^spec\/(ssot|tasks|review|reports|ideation)\/.+\.md$/.test(path)
  )
    return 'documentation'
  if (path.startsWith('apps/api/')) return 'backend'
  if (GUARD_FILES.has(path)) return 'guards'
  return null
}

function selection(config, workspaceRoot) {
  const gitRoot = realpathSync(
    command('git', ['rev-parse', '--show-toplevel'], workspaceRoot).replace(/\r?\n$/, ''),
  )
  if (!inside(gitRoot, workspaceRoot))
    throw new Error('The project is outside its discovered Git root')
  const base = command(
    'git',
    ['rev-parse', '--verify', '--end-of-options', `${config.base}^{commit}`],
    workspaceRoot,
  ).trim()
  if (!/^[a-f0-9]{40,64}$/.test(base)) throw new Error('Git returned an invalid base commit')
  const diff = command(
    'git',
    ['diff', '--name-only', '-z', '--no-renames', '--no-relative', base, '--', workspaceRoot],
    workspaceRoot,
  )
  if (diff && !diff.endsWith('\0')) throw new Error('Git returned an incomplete changed-file list')
  const changedFiles = [...new Set(diff.split('\0').filter(Boolean))].sort()
  const projects = inventory(
    pnpm(['-r', 'list', '--depth', '-1', '--json'], workspaceRoot),
    workspaceRoot,
  ).filter((project) => project.path !== workspaceRoot)
  if (!projects.length) throw new Error('Workspace inventory has no named child projects')
  const changed = new Set()
  const fallbackPaths = []
  const outsideWorkspace = []
  const owners = [...projects].sort((a, b) => b.path.length - a.path.length)
  for (const file of changedFiles) {
    const absolute = resolve(gitRoot, file)
    if (!inside(workspaceRoot, absolute))
      throw new Error('Git returned a change outside the project')
    const local = relative(workspaceRoot, absolute).split(sep).join('/')
    const owner = owners.find((project) => inside(project.path, absolute))
    if (owner) changed.add(owner.name)
    if (sharedInput(local)) fallbackPaths.push(local)
    else if (!owner) {
      const kind = outsideKind(local)
      if (kind) outsideWorkspace.push({ path: local, kind })
      else fallbackPaths.push(local)
    }
  }
  const requested = projects.filter((project) => fallbackPaths.length || changed.has(project.name))
  const filters = requested.flatMap((project) => ['--filter', `...${project.name}`])
  let selected = []
  if (requested.length) {
    selected = inventory(
      pnpm(
        ['-r', '--fail-if-no-match', ...filters, 'list', '--depth', '-1', '--json'],
        workspaceRoot,
      ),
      workspaceRoot,
    ).filter((project) => project.path !== workspaceRoot)
    if (
      !selected.length ||
      requested.some((project) => !selected.some((match) => match.name === project.name)) ||
      selected.some(
        (project) =>
          !projects.some((match) => match.name === project.name && match.path === project.path),
      )
    )
      throw new Error(
        'Affected selection is unexpectedly empty or does not match the workspace inventory',
      )
  }
  const byName = (a, b) => a.name.localeCompare(b.name)
  return {
    report: {
      mode: config.mode,
      base,
      workspaceRoot,
      gitRoot,
      changedFiles,
      changedProjects: projects.filter((project) => changed.has(project.name)).sort(byName),
      projects: selected.sort(byName),
      reason: fallbackPaths.length
        ? 'shared-or-unknown-input'
        : changed.size
          ? 'changed-projects'
          : changedFiles.length
            ? 'known-non-workspace-only'
            : 'no-tracked-changes',
      fallbackPaths,
      outsideWorkspace,
    },
    filters,
  }
}

try {
  const config = options(process.argv.slice(2))
  const workspaceRoot = realpathSync(repoRoot)
  const { report, filters } = selection(config, workspaceRoot)
  process.stdout.write(`${JSON.stringify(report)}\n`)
  if (!config.list && report.projects.length)
    process.exitCode = pnpm(
      ['-r', '--fail-if-no-match', ...filters, 'run', config.mode],
      workspaceRoot,
      false,
    )
} catch (error) {
  console.error(`Affected checks failed: ${error.message}`)
  process.exitCode = 1
}
