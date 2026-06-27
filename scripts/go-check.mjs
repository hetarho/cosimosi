#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { fail, mount, ok, repoRoot, section } from './lib.mjs'

const image = 'golang:1.26'
const mode = process.argv[2] ?? 'all'

const checks = {
  fmt: {
    docker: 'files=$(gofmt -l .); if [ -n "$files" ]; then printf "%s\\n" "$files"; exit 1; fi',
    host: ['gofmt', ['-l', '.']],
    failOnStdout: true,
  },
  vet: {
    docker: 'go vet ./...',
    host: ['go', ['vet', './...']],
  },
  test: {
    docker: 'go test ./...',
    host: ['go', ['test', './...']],
  },
  build: {
    docker: 'go build ./...',
    host: ['go', ['build', './...']],
  },
}

const plan =
  mode === 'all'
    ? ['fmt', 'vet', 'test', 'build']
    : mode in checks
      ? [mode]
      : []

if (!plan.length) {
  console.error(`Unknown api check "${mode}". Use one of: all, ${Object.keys(checks).join(', ')}`)
  process.exit(1)
}

const hasHostGo = () => {
  const result = spawnSync('go', ['version'], { cwd: repoRoot, stdio: 'ignore' })
  return !result.error && result.status === 0
}

const run = (cmd, args, opts = {}) => {
  const result = spawnSync(cmd, args, { cwd: repoRoot, stdio: 'inherit', shell: false, ...opts })
  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }
  if (result.status) process.exit(result.status)
}

const runHost = (name) => {
  const check = checks[name]
  const [cmd, args] = check.host
  const result = spawnSync(cmd, args, {
    cwd: `${repoRoot}/apps/api`,
    encoding: check.failOnStdout ? 'utf8' : undefined,
    stdio: check.failOnStdout ? 'pipe' : 'inherit',
    shell: false,
  })
  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }
  if (check.failOnStdout && result.stdout.trim()) {
    console.error(result.stdout.trim())
    fail('api gofmt is not clean')
  }
  if (result.status) process.exit(result.status)
}

section(`api ${mode}`)

if (hasHostGo()) {
  for (const name of plan) {
    runHost(name)
  }
} else {
  run('docker', [
    'run',
    '--rm',
    '-v',
    mount('apps/api', '/app'),
    '-w',
    '/app',
    image,
    'sh',
    '-c',
    plan.map((name) => checks[name].docker).join(' && '),
  ])
}

ok(`api ${mode} passed`)
