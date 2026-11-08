import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, test } from 'node:test'
import { pathToFileURL } from 'node:url'

import { repoRoot } from './lib.mjs'

const containers = []
afterEach(() => {
  for (const path of containers.splice(0)) rmSync(path, { recursive: true, force: true })
})

function put(root, path, source) {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, source)
}

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 10_000 })
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

const packagePaths = {
  core: 'packages/a',
  other: 'packages/ab',
  ui: 'packages/ui',
  app: 'packages/app',
  native: 'packages/native',
}
const closure = ['app', 'core', 'native', 'ui']
const all = ['app', 'core', 'native', 'other', 'ui']
const portableFile = process.platform === 'win32' ? 'space 한글.ts' : 'space 한글\nline.ts'

function fixture(linked = false, withGit = true) {
  const container = realpathSync(mkdtempSync(join(tmpdir(), 'cosimosi-affected-')))
  containers.push(container)
  let ordinary = join(container, 'ordinary work 한글 ')
  const records = join(container, 'records')
  mkdirSync(ordinary)
  ordinary = realpathSync(ordinary)
  mkdirSync(records)
  put(ordinary, 'package.json', JSON.stringify({ name: 'fixture-root', private: true }))
  put(ordinary, 'pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n")
  for (const file of ['check-affected.mjs', 'lib.mjs']) {
    mkdirSync(join(ordinary, 'scripts'), { recursive: true })
    cpSync(join(repoRoot, 'scripts', file), join(ordinary, 'scripts', file))
  }
  const dependencies = {
    core: {},
    other: {},
    ui: { dependencies: { '@fixture/core': 'workspace:*' } },
    app: {
      devDependencies: { '@fixture/ui': 'workspace:*' },
      optionalDependencies: { '@fixture/core': 'workspace:*' },
    },
    native: { peerDependencies: { '@fixture/core': 'workspace:*' } },
  }
  for (const [name, path] of Object.entries(packagePaths)) {
    put(
      ordinary,
      `${path}/package.json`,
      JSON.stringify({
        name: `@fixture/${name}`,
        version: '1.0.0',
        private: true,
        scripts: { typecheck: 'node record.cjs typecheck', test: 'node record.cjs test' },
        ...dependencies[name],
      }),
    )
    put(ordinary, `${path}/src/${portableFile}`, 'export const value = 1\n')
    put(ordinary, `${path}/README.md`, 'Package documentation\n')
    put(
      ordinary,
      `${path}/record.cjs`,
      `const fs = require('node:fs'); const path = require('node:path');
const name = require('./package.json').name;
fs.appendFileSync(path.join(process.env.COSIMOSI_AFFECTED_RECORDS, name.replaceAll('/', '_') + '.jsonl'), JSON.stringify({name, cwd:fs.realpathSync(process.cwd()), mode:process.argv[2]}) + '\\n');\n`,
    )
  }
  for (const file of [
    'README.md',
    'spec/ssot/ARCH.md',
    'spec/mystery.md',
    'spec/values.yaml',
    'scripts/go-check.mjs',
    'scripts/go-check-extra.mjs',
    'scripts/lint-public-copy.mjs',
    'scripts/subprocess-results.test.mjs',
    'apps/api/main.go',
    'apps/api/db/migrations/001.sql',
    'proto/fixture.proto',
    'packages/ui/src/tokens.ts',
    'pnpm-lock.yaml',
    '.npmrc',
    '.node-version',
    'unknown.ts',
    'scripts/check-unknown.mjs',
  ])
    put(ordinary, file, file === '.npmrc' ? '\n' : 'fixture\n')
  let base
  let root = ordinary
  if (withGit) {
    git(ordinary, 'init', '-q')
    git(ordinary, 'add', '.')
    git(
      ordinary,
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      'baseline',
    )
    base = git(ordinary, 'rev-parse', 'HEAD')
    if (linked) {
      root = join(container, 'linked work 한글')
      git(ordinary, 'worktree', 'add', '--quiet', '--detach', root, base)
    }
  }
  return { container, root, records, base }
}

function invoke(workspace, args, extraEnv = {}, preload) {
  for (const file of readdirSync(workspace.records)) rmSync(join(workspace.records, file))
  const env = { ...process.env, COSIMOSI_AFFECTED_RECORDS: workspace.records, ...extraEnv }
  if (!Object.hasOwn(extraEnv, 'HAERAM_DIFF_BASE')) delete env.HAERAM_DIFF_BASE
  const result = spawnSync(
    process.execPath,
    [
      ...(preload ? ['--import', pathToFileURL(preload).href] : []),
      join(workspace.root, 'scripts/check-affected.mjs'),
      ...args,
    ],
    { cwd: workspace.container, env, encoding: 'utf8', timeout: 30_000 },
  )
  assert.ifError(result.error)
  const firstLine = result.stdout.split('\n')[0]
  const report = firstLine.startsWith('{') ? JSON.parse(firstLine) : null
  const records = readdirSync(workspace.records).flatMap((file) =>
    readFileSync(join(workspace.records, file), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line)),
  )
  return { ...result, report, records }
}

function assertExecutions(result, workspace, names, mode) {
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(
    result.report.projects.map((project) => project.name),
    names.map((name) => `@fixture/${name}`),
  )
  assert.deepEqual(
    result.records.map((record) => record.name).sort(),
    names.map((name) => `@fixture/${name}`),
  )
  for (const record of result.records) {
    const name = record.name.slice('@fixture/'.length)
    assert.equal(record.cwd, realpathSync(join(workspace.root, packagePaths[name])))
    assert.equal(record.mode, mode)
  }
}

for (const linked of [false, true]) {
  const kind = linked ? 'linked' : 'ordinary'
  test(`${kind}: dirty whitespace/Unicode paths select actual transitive, dev, peer and optional dependents`, () => {
    const workspace = fixture(linked)
    put(workspace.root, `packages/a/src/${portableFile}`, 'export const value = 2\n')
    put(workspace.root, 'packages/ab/src/untracked.ts', 'export const untracked = 1\n')
    const result = invoke(workspace, ['typecheck', '--base', workspace.base])
    assertExecutions(result, workspace, closure, 'typecheck')
    assert.equal(result.report.reason, 'changed-projects')
    assert.equal(result.report.workspaceRoot, workspace.root)
    assert.ok(result.report.changedFiles.includes(`packages/a/src/${portableFile}`))
  })

  test(`${kind}: staged additions and multiple owners respect package path boundaries`, () => {
    const workspace = fixture(linked)
    put(workspace.root, 'packages/ab/src/added.ts', 'export const added = 1\n')
    git(workspace.root, 'add', 'packages/ab/src/added.ts')
    put(workspace.root, `packages/native/src/${portableFile}`, 'export const value = 2\n')
    assertExecutions(
      invoke(workspace, ['test', '--base', workspace.base]),
      workspace,
      ['native', 'other'],
      'test',
    )
  })

  test(`${kind}: committed changes honor explicit, environment and default base precedence; list never executes`, () => {
    const workspace = fixture(linked)
    put(workspace.root, 'packages/a/README.md', 'Changed package documentation\n')
    git(workspace.root, 'add', '.')
    git(
      workspace.root,
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      'package change',
    )
    const current = git(workspace.root, 'rev-parse', 'HEAD')
    const defaults = invoke(workspace, ['list'])
    assert.equal(defaults.status, 0, defaults.stderr)
    assert.equal(defaults.report.base, current)
    assert.equal(defaults.report.reason, 'no-tracked-changes')
    const fromEnv = invoke(workspace, ['test', '--list'], { HAERAM_DIFF_BASE: workspace.base })
    assert.equal(fromEnv.status, 0, fromEnv.stderr)
    assert.deepEqual(
      fromEnv.report.projects.map((project) => project.name),
      closure.map((name) => `@fixture/${name}`),
    )
    assert.deepEqual(fromEnv.records, [])
    const explicit = invoke(workspace, ['typecheck', '--base', workspace.base, '--list'], {
      HAERAM_DIFF_BASE: 'invalid-env-ref',
    })
    assert.equal(explicit.status, 0, explicit.stderr)
    assert.equal(explicit.report.base, workspace.base)
    assert.deepEqual(explicit.records, [])
  })

  test(`${kind}: cross-package renames retain both owners and deletions retain their dependents`, () => {
    const workspace = fixture(linked)
    git(workspace.root, 'mv', `packages/a/src/${portableFile}`, 'packages/ab/src/moved.ts')
    rmSync(join(workspace.root, `packages/ui/src/${portableFile}`))
    const result = invoke(workspace, ['test', '--base', workspace.base])
    assertExecutions(result, workspace, all, 'test')
    assert.equal(result.report.reason, 'changed-projects')
    assert.ok(result.report.changedFiles.includes(`packages/a/src/${portableFile}`))
    assert.ok(result.report.changedFiles.includes('packages/ab/src/moved.ts'))
  })

  test(`${kind}: removed ownership conservatively checks every remaining project`, () => {
    const workspace = fixture(linked)
    rmSync(join(workspace.root, 'packages/ab'), { recursive: true })
    const result = invoke(workspace, ['typecheck', '--base', workspace.base])
    assertExecutions(result, workspace, closure, 'typecheck')
    assert.equal(result.report.reason, 'shared-or-unknown-input')
    assert.ok(result.report.fallbackPaths.includes('packages/ab/package.json'))
  })

  for (const mode of ['typecheck', 'test']) {
    for (const withSubprocessTest of [false, true]) {
      test(`${kind}: Go gate selection: ${mode}, ${withSubprocessTest ? 'with subprocess test' : 'wrapper only'}`, (t) => {
        const workspace = fixture(linked)
        const paths = [
          'scripts/go-check.mjs',
          ...(withSubprocessTest ? ['scripts/subprocess-results.test.mjs'] : []),
        ]
        for (const path of paths) put(workspace.root, path, 'changed\n')
        const result = invoke(workspace, [mode, '--base', workspace.base])
        t.diagnostic(JSON.stringify({ paths, report: result.report, records: result.records }))
        assertExecutions(result, workspace, [], mode)
        assert.equal(result.report.reason, 'known-non-workspace-only')
        assert.deepEqual(result.report.fallbackPaths, [])
        assert.deepEqual(
          result.report.outsideWorkspace,
          paths.map((path) => ({ path, kind: 'guards' })),
        )
      })
    }

    test(`${kind}: Go gate combinations retain ${mode} coverage`, (t) => {
      const workspace = fixture(linked)
      put(workspace.root, 'scripts/go-check.mjs', 'changed\n')
      for (const [path, expected] of [
        [`packages/a/src/${portableFile}`, closure],
        ['scripts/lib.mjs', all],
        ['proto/fixture.proto', all],
        ['apps/api/db/migrations/001.sql', all],
        ['scripts/go-check-extra.mjs', all],
      ]) {
        const source = readFileSync(join(workspace.root, path), 'utf8')
        put(workspace.root, path, `${source}\n`)
        const result = invoke(workspace, [mode, '--base', workspace.base])
        t.diagnostic(JSON.stringify({ path, report: result.report, records: result.records }))
        assertExecutions(result, workspace, expected, mode)
        assert.equal(
          result.report.reason,
          expected === closure ? 'changed-projects' : 'shared-or-unknown-input',
        )
        assert.ok(
          result.report.outsideWorkspace.some(
            (entry) => entry.path === 'scripts/go-check.mjs' && entry.kind === 'guards',
          ),
        )
        if (expected !== closure) assert.ok(result.report.fallbackPaths.includes(path))
        git(workspace.root, 'restore', path)
      }
    })
  }
}

test('shared generator/proto/config inputs and unknown ownership retain all project checks', () => {
  const workspace = fixture(true)
  for (const path of [
    'package.json',
    'pnpm-workspace.yaml',
    '.npmrc',
    '.node-version',
    'spec/values.yaml',
    'proto/fixture.proto',
    'apps/api/db/migrations/001.sql',
    'packages/ui/src/tokens.ts',
    'pnpm-lock.yaml',
    'spec/mystery.md',
    'scripts/check-unknown.mjs',
  ]) {
    const source = readFileSync(join(workspace.root, path), 'utf8')
    put(
      workspace.root,
      path,
      path === 'package.json'
        ? JSON.stringify({ ...JSON.parse(source), description: 'changed' })
        : `${source}\n`,
    )
    const result = invoke(workspace, ['list', '--base', workspace.base])
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(
      result.report.projects.map((project) => project.name),
      all.map((name) => `@fixture/${name}`),
    )
    assert.equal(result.report.reason, 'shared-or-unknown-input')
    if (path === 'packages/ui/src/tokens.ts')
      assert.deepEqual(
        result.report.changedProjects.map((project) => project.name),
        ['@fixture/ui'],
      )
    git(workspace.root, 'restore', path)
  }
  put(workspace.root, 'unknown.ts', 'changed\n')
  assertExecutions(invoke(workspace, ['test', '--base', workspace.base]), workspace, all, 'test')
})

test('known non-workspace changes and untracked-only changes explicitly select no package checks', () => {
  const workspace = fixture(true)
  put(workspace.root, 'packages/a/src/untracked.ts', 'export const value = 1\n')
  const untracked = invoke(workspace, ['test'])
  assert.equal(untracked.status, 0, untracked.stderr)
  assert.equal(untracked.report.reason, 'no-tracked-changes')
  assert.deepEqual(untracked.records, [])
  for (const path of [
    'README.md',
    'spec/ssot/ARCH.md',
    'scripts/lint-public-copy.mjs',
    'apps/api/main.go',
  ])
    put(workspace.root, path, 'changed\n')
  const outside = invoke(workspace, ['typecheck'])
  assert.equal(outside.status, 0, outside.stderr)
  assert.equal(outside.report.reason, 'known-non-workspace-only')
  assert.deepEqual(outside.report.projects, [])
  assert.deepEqual(
    new Set(outside.report.outsideWorkspace.map(({ kind }) => kind)),
    new Set(['documentation', 'guards', 'backend']),
  )
  assert.deepEqual(outside.records, [])
})

test('a workspace with no named child projects is a discovery error', () => {
  const workspace = fixture(true)
  rmSync(join(workspace.root, 'packages'), { recursive: true })
  const result = invoke(workspace, ['list'])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /no named child projects/)
  assert.deepEqual(result.records, [])
})

test('invalid bases, invalid arguments and Git discovery failure cannot become empty success', () => {
  const workspace = fixture()
  for (const args of [['list', '--base', 'does-not-exist'], ['test', '--base'], ['unexpected']]) {
    const result = invoke(workspace, args)
    assert.notEqual(result.status, 0)
    assert.deepEqual(result.records, [])
  }
  const outside = fixture(false, false)
  const result = invoke(outside, ['list'])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Affected checks failed/)
})

// Only discovery/execution failure cases use a preload. Positive selection and package executions
// above use the installed pnpm graph and actual Git repositories without subprocess doubles.
function failurePreload(workspace, scenario) {
  const path = join(workspace.container, `failure-${scenario}.mjs`)
  const project = { name: '@fixture/core', path: join(workspace.root, 'packages/a') }
  writeFileSync(
    path,
    `import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
const realSpawn = childProcess.spawnSync;
childProcess.spawnSync = (command, args, options) => {
  const pnpm = command === 'pnpm' || (command === 'cmd' && args[1] === 'pnpm');
  const expansion = args.includes('--filter');
  const execution = args.includes('run');
  if (pnpm) {
    const scenario = ${JSON.stringify(scenario)};
    if ((scenario === 'inventory-signal' && !expansion) || (scenario === 'execution-signal' && execution))
      return realSpawn(process.execPath, ['-e', "process.kill(process.pid, 'SIGTERM')"], options);
    let text;
    if (scenario === 'malformed-inventory' && !expansion) text = '{}';
    if (scenario === 'duplicate-inventory' && !expansion) text = JSON.stringify([${JSON.stringify(project)}, ${JSON.stringify(project)}]);
    if (scenario === 'empty-expansion' && expansion) text = '[]';
    if (text !== undefined) return realSpawn(process.execPath, ['-e', 'process.stdout.write(' + JSON.stringify(text) + ')'], options);
  }
  return realSpawn(command, args, options);
};
syncBuiltinESMExports();\n`,
  )
  return path
}

for (const scenario of [
  'malformed-inventory',
  'duplicate-inventory',
  'empty-expansion',
  'inventory-signal',
  'execution-signal',
]) {
  test(`${scenario} fails instead of reporting an empty successful check`, () => {
    const workspace = fixture(true)
    put(workspace.root, `packages/a/src/${portableFile}`, 'export const value = 2\n')
    const result = invoke(workspace, ['test'], {}, failurePreload(workspace, scenario))
    assert.notEqual(result.status, 0, result.stderr)
    assert.deepEqual(result.records, [])
  })
}
