import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, test } from 'node:test'
import { pathToFileURL } from 'node:url'

import { repoRoot, subprocessExitCode } from './lib.mjs'

const roots = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'cosimosi-subprocess-')))
  roots.push(root)
  return root
}

const marker = 'subprocess-regression'
const env = () => ({ ...process.env, COSIMOSI_SUBPROCESS_PROBE: marker })
const libURL = pathToFileURL(join(repoRoot, 'scripts/lib.mjs')).href
const outcomes = ['zero', 'nonzero', 'missing', 'signal']

function fixtureShell() {
  if (process.platform !== 'win32') return '/bin/sh'
  // Git supplies the shell Husky already uses, even from a PowerShell PATH without sh.
  const git = spawnSync('git', ['--exec-path'], { encoding: 'utf8', timeout: 5_000 })
  assert.ifError(git.error)
  assert.equal(git.status, 0, git.stderr)
  for (const path of ['bin/sh.exe', 'usr/bin/sh.exe']) {
    const shell = resolve(git.stdout.trim(), '../../..', path)
    if (existsSync(shell)) return shell
  }
  assert.fail('The existing Git installation must provide its Husky POSIX shell')
}

const shellQuote = (value) => `'${value.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`

function shellFixtures(root, config, log, formatter) {
  const bin = join(root, 'bin')
  mkdirSync(bin)
  for (const name of ['gofmt', 'go']) {
    if (name === 'gofmt' && formatter.outcome === 'missing') continue
    const program = join(root, `${name}.cjs`)
    writeFileSync(
      program,
      `const fs = require('node:fs');
const args = process.argv.slice(2);
const name = ${JSON.stringify(name)};
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({key:name, args}) + '\\n');
if (name === 'go') {
  if (!['vet', 'test', 'build'].includes(args[0]) || args[1] !== './...' || args.length !== 2)
    throw new Error('Unexpected Go fixture command: ' + args.join(' '));
} else {
  if (args.length !== 2 || args[0] !== '-l' || args[1] !== '.') throw new Error('Unexpected formatter arguments');
  const step = JSON.parse(fs.readFileSync(${JSON.stringify(config)}, 'utf8')).docker.formatter;
  process.stdout.write(step.stdout ?? '');
  process.stderr.write(step.stderr ?? '');
  if (step.outcome === 'signal') process.kill(process.pid, 'SIGTERM');
  else process.exit(step.outcome === 'nonzero' ? 17 : 0);
}
`,
    )
    writeFileSync(
      join(bin, name),
      `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(program)} "$@"\n`,
      { mode: 0o755 },
    )
  }
  return { shell: fixtureShell(), bin }
}

function childSource(outcome, stdout = '') {
  if (outcome === 'signal') return "process.kill(process.pid, 'SIGTERM')"
  return `process.stdout.write(${JSON.stringify(stdout)}); process.exit(${outcome === 'nonzero' ? 17 : 0})`
}

function runLib(outcome) {
  const root = fixture()
  const command = outcome === 'missing' ? join(root, 'absent-executable') : process.execPath
  const source = `import { run } from ${JSON.stringify(libURL)};
run(${JSON.stringify(command)}, ['-e', ${JSON.stringify(childSource(outcome))}]);
console.log('wrapper completed');`
  return spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: root,
    env: env(),
    encoding: 'utf8',
    timeout: 10_000,
  })
}

test('missing numeric completion cannot satisfy a successful exit', () => {
  for (const status of [null, undefined, Number.NaN])
    assert.equal(subprocessExitCode({ status, signal: 'SIGTERM' }), 1)
  assert.equal(subprocessExitCode({ status: 0 }), 0)
  assert.equal(subprocessExitCode({ status: 17 }), 17)
})

for (const outcome of outcomes) {
  test(`shared command wrapper handles real ${outcome} completion`, () => {
    const result = runLib(outcome)
    assert.ifError(result.error)
    assert.equal(result.status, outcome === 'zero' ? 0 : 1, result.stderr)
    assert.equal(result.stdout.includes('wrapper completed'), outcome === 'zero')
    if (outcome === 'missing') assert.match(result.stderr, /PATH/)
  })
}

test('shared command wrapper preserves default cwd, environment and inherited stdout/stderr', () => {
  const root = fixture()
  const child = `console.log(JSON.stringify({cwd:process.cwd(),marker:process.env.COSIMOSI_SUBPROCESS_PROBE})); console.error('child stderr');`
  const source = `import { run } from ${JSON.stringify(libURL)}; run(process.execPath, ['-e', ${JSON.stringify(child)}]);`
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: root,
    env: env(),
    encoding: 'utf8',
    timeout: 10_000,
  })
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), { cwd: repoRoot, marker })
  assert.equal(result.stderr.trim(), 'child stderr')
})

test('shared command wrapper preserves explicit spawn options', () => {
  const root = fixture()
  const child = 'console.log(process.cwd(), process.env.COSIMOSI_SUBPROCESS_PROBE)'
  const source = `import { run } from ${JSON.stringify(libURL)};
run(process.execPath, ['-e', ${JSON.stringify(child)}], { cwd: ${JSON.stringify(root)}, env: { ...process.env, COSIMOSI_SUBPROCESS_PROBE: 'override' }, stdio: 'inherit' });`
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: repoRoot,
    env: env(),
    encoding: 'utf8',
    timeout: 10_000,
  })
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), `${root} override`)
})

// The preload replaces only executable selection. Every result comes from a real child process;
// unexpected commands fail before they can reach Docker, Go, Git or code generation.
function runScript(script, args, steps) {
  const root = fixture()
  const config = join(root, 'steps.json')
  const log = join(root, 'commands.jsonl')
  const preload = join(root, 'executables.mjs')
  writeFileSync(config, JSON.stringify(steps))
  writeFileSync(log, '')
  const shell =
    steps.docker?.outcome === 'shell'
      ? shellFixtures(root, config, log, steps.docker.formatter)
      : null
  const executionEnv = env()
  if (shell) delete executionEnv.COSIMOSI_TEST_DATABASE_URL
  writeFileSync(
    preload,
    `import childProcess from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const realSpawn = childProcess.spawnSync;
const steps = JSON.parse(readFileSync(${JSON.stringify(config)}, 'utf8'));
childProcess.spawnSync = (command, args, options = {}) => {
  const key = command === 'go' ? (args[0] === 'version' ? 'go-version' : 'go')
    : command === 'docker' ? 'docker'
    : command === 'gofmt' ? 'gofmt'
    : command === 'git' ? (args[0] === 'diff' ? 'git-diff' : 'git-untracked')
    : command === 'pnpm' || (command === 'cmd' && args[0] === '/c' && args[1] === 'pnpm') ? 'pnpm' : null;
  if (!key || !Object.hasOwn(steps, key)) throw new Error('Unexpected executable: ' + command);
  appendFileSync(${JSON.stringify(log)}, JSON.stringify({key, command, args, cwd: options.cwd, stdio: options.stdio, shell: options.shell, marker: options.env?.COSIMOSI_SUBPROCESS_PROBE}) + '\\n');
  const step = steps[key];
  if (step.outcome === 'shell') {
    if (key !== 'docker' || args.at(-3) !== 'sh' || args.at(-2) !== '-c')
      throw new Error('Unexpected Docker shell invocation');
    return realSpawn(${JSON.stringify(shell?.shell)}, ['-c', args.at(-1)], {
      ...options, cwd: ${JSON.stringify(root)}, env: {...process.env, PATH:${JSON.stringify(shell?.bin)}}, timeout: 5_000,
    });
  }
  if (step.outcome === 'missing') return realSpawn(${JSON.stringify(join(root, 'absent-executable'))}, [], options);
  const source = step.outcome === 'signal' ? "process.kill(process.pid, 'SIGTERM')"
    : 'process.stdout.write(' + JSON.stringify(step.stdout ?? '') + '); process.exit(' + (step.outcome === 'nonzero' ? 17 : 0) + ')';
  return realSpawn(process.execPath, ['-e', source], options);
};
syncBuiltinESMExports();
`,
  )
  const result = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(preload).href, join(repoRoot, script), ...args],
    { cwd: root, env: executionEnv, encoding: 'utf8', timeout: 10_000 },
  )
  assert.ifError(result.error)
  const calls = readFileSync(log, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  return { ...result, calls, shell: shell?.shell }
}

for (const host of [true, false]) {
  for (const outcome of outcomes) {
    test(`Go ${host ? 'host' : 'Docker'} wrapper handles real ${outcome} completion`, () => {
      const key = host ? 'go' : 'docker'
      const result = runScript('scripts/go-check.mjs', ['build'], {
        'go-version': { outcome: host ? 'zero' : 'nonzero' },
        [key]: { outcome },
      })
      if (outcome === 'signal') assert.notEqual(result.status, 0, result.stderr)
      else
        assert.equal(
          result.status,
          outcome === 'zero' ? 0 : outcome === 'nonzero' ? 17 : 1,
          result.stderr,
        )
      assert.equal(result.stdout.includes('api build passed'), outcome === 'zero')
      assert.deepEqual(
        result.calls.map((call) => call.key),
        ['go-version', key],
      )
      const call = result.calls.at(-1)
      assert.equal(call.cwd, host ? join(repoRoot, 'apps/api') : repoRoot)
      assert.equal(call.stdio, 'inherit')
      assert.equal(call.shell, false)
      if (host) {
        assert.deepEqual(call.args, ['build', './...'])
        assert.equal(call.marker, marker)
      } else {
        assert.ok(call.args.includes('golang:1.26'))
        assert.equal(call.args.at(-1), 'go build ./...')
      }
    })
  }
}

for (const stdout of ['', 'unformatted.go\n']) {
  test(`host gofmt ${stdout ? 'rejects listed files' : 'accepts clean output'}`, () => {
    const result = runScript('scripts/go-check.mjs', ['fmt'], {
      'go-version': { outcome: 'zero' },
      gofmt: { outcome: 'zero', stdout },
    })
    assert.equal(result.status, stdout ? 1 : 0, result.stderr)
    assert.equal(result.calls.at(-1).stdio, 'pipe')
    if (stdout) assert.match(result.stderr, /unformatted\.go|gofmt is not clean/)
  })
}

const formatterCases = [
  { name: 'clean', outcome: 'zero', succeeds: true },
  { name: 'unformatted', outcome: 'zero', stdout: 'unformatted.go\n' },
  { name: 'failed with empty stdout', outcome: 'nonzero', stderr: 'formatter parse error\n' },
  {
    name: 'failed with listed output',
    outcome: 'nonzero',
    stdout: 'unformatted.go\n',
    stderr: 'formatter parse error\n',
  },
  { name: 'missing', outcome: 'missing' },
  { name: 'interrupted', outcome: 'signal', stderr: 'formatter interrupted\n' },
]

for (const formatter of formatterCases) {
  test(`Docker formatting executes the real shell: ${formatter.name}`, (t) => {
    const result = runScript('scripts/go-check.mjs', ['fmt'], {
      'go-version': { outcome: 'nonzero' },
      docker: { outcome: 'shell', formatter },
    })
    assert.equal(result.status === 0, formatter.succeeds === true, result.stderr)
    assert.equal(result.stdout.includes('api fmt passed'), formatter.succeeds === true)
    assert.deepEqual(
      result.calls.map((call) => call.key),
      formatter.outcome === 'missing'
        ? ['go-version', 'docker']
        : ['go-version', 'docker', 'gofmt'],
    )
    if (formatter.stderr) assert.ok(result.stderr.includes(formatter.stderr), result.stderr)
    if (formatter.outcome === 'missing') assert.match(result.stderr, /gofmt.*not found/)
    if (formatter.stdout) assert.ok(result.stdout.includes(formatter.stdout), result.stdout)
    t.diagnostic(
      JSON.stringify({
        platform: process.platform,
        shell: result.shell,
        status: result.status,
        trace: result.calls.map((call) => [call.key, ...call.args]),
        stdout: result.stdout,
        stderr: result.stderr,
      }),
    )
  })
}

for (const fails of [false, true]) {
  test(`Docker all-plan ${fails ? 'stops at failed formatting' : 'runs each stage in order'}`, (t) => {
    const result = runScript('scripts/go-check.mjs', ['all'], {
      pnpm: { outcome: 'zero' },
      'go-version': { outcome: 'nonzero' },
      docker: {
        outcome: 'shell',
        formatter: {
          outcome: fails ? 'nonzero' : 'zero',
          stderr: fails ? 'formatter failed\n' : '',
        },
      },
    })
    assert.equal(result.status === 0, !fails, result.stderr)
    assert.equal(result.stdout.includes('api all passed'), !fails)
    assert.deepEqual(
      result.calls.slice(0, 3).map((call) => call.key),
      ['pnpm', 'go-version', 'docker'],
    )
    assert.deepEqual(result.calls[0].args.slice(-1), ['db:migrate'])
    assert.deepEqual(
      result.calls.slice(3).map((call) => [call.key, ...call.args]),
      [
        ['gofmt', '-l', '.'],
        ...(fails
          ? []
          : [
              ['go', 'vet', './...'],
              ['go', 'test', './...'],
              ['go', 'build', './...'],
            ]),
      ],
    )
    if (fails) assert.match(result.stderr, /formatter failed/)
    t.diagnostic(
      JSON.stringify({
        platform: process.platform,
        shell: result.shell,
        status: result.status,
        trace: result.calls.map((call) => [call.key, ...call.args]),
        stdout: result.stdout,
        stderr: result.stderr,
      }),
    )
  })
}

for (const git of ['git-diff', 'git-untracked']) {
  for (const outcome of outcomes) {
    test(`generated output wrapper handles real ${outcome} completion of ${git}`, () => {
      const result = runScript('scripts/check-generated.mjs', [], {
        pnpm: { outcome: 'zero' },
        'git-diff': { outcome: 'zero' },
        'git-untracked': { outcome: 'zero' },
        [git]: { outcome },
      })
      assert.equal(result.status, outcome === 'zero' ? 0 : 1, result.stderr)
      assert.equal(result.stdout.includes('generated outputs are fresh'), outcome === 'zero')
      assert.equal(result.calls[0].key, 'pnpm')
      assert.deepEqual(result.calls[0].args.slice(-1), ['gen'])
      assert.equal(result.calls[0].stdio, 'inherit')
      assert.ok(result.calls.every((call) => call.cwd === repoRoot))
      const queried = result.calls.slice(1).map((call) => call.key)
      assert.deepEqual(
        queried,
        git === 'git-diff' && outcome !== 'zero' ? ['git-diff'] : ['git-diff', 'git-untracked'],
      )
    })
  }
}

test('generated output wrapper still rejects changed generated files', () => {
  const result = runScript('scripts/check-generated.mjs', [], {
    pnpm: { outcome: 'zero' },
    'git-diff': { outcome: 'zero', stdout: 'packages/example/src/example.gen.ts\n' },
    'git-untracked': { outcome: 'zero' },
  })
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stderr, /generated outputs are stale/)
  assert.match(result.stderr, /example\.gen\.ts/)
})
