import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import { fail, ok, repoRoot, section } from './lib.mjs'

const root = repoRoot

const checks = [
  {
    dir: 'apps/web/src',
    extensions: ['.ts', '.tsx'],
    forbidden: ['@sentry/react', '@sentry/browser', '@sentry/core', 'posthog-js'],
    allowed: [/^apps\/web\/src\/app\/providers\/observability-provider\.tsx$/],
  },
  {
    dir: 'apps/mobile/src',
    extensions: ['.ts', '.tsx'],
    forbidden: ['@sentry/react-native', 'posthog-react-native'],
    allowed: [
      /^apps\/mobile\/src\/app\/providers\/observability-provider\.tsx$/,
      /^apps\/mobile\/src\/app\/providers\/observability-provider\.test\.tsx$/,
    ],
  },
  {
    dir: 'packages',
    extensions: ['.ts', '.tsx'],
    forbidden: [
      '@sentry/react',
      '@sentry/react-native',
      '@sentry/browser',
      '@sentry/core',
      'posthog-js',
      'posthog-react-native',
    ],
    allowed: [],
  },
  {
    dir: 'apps/api/internal',
    extensions: ['.go'],
    forbidden: ['github.com/getsentry/sentry-go'],
    allowed: [/^apps\/api\/internal\/platform\/observability\/sentry\.go$/],
  },
  // The composition root sees every concrete (§2.4), which is exactly why the SDK is tempting here —
  // and why it must still arrive through the platform adapter. Nothing is allowlisted.
  {
    dir: 'apps/api/cmd',
    extensions: ['.go'],
    forbidden: ['github.com/getsentry/sentry-go'],
    allowed: [],
  },
  // A shipped build target with no telemetry today. Listed so the rule holds the first time it gains
  // some, rather than being noticed afterwards.
  {
    dir: 'apps/blog/src',
    extensions: ['.ts', '.tsx', '.astro', '.js'],
    forbidden: ['@sentry/astro', '@sentry/browser', '@sentry/core', 'posthog-js'],
    allowed: [],
  },
]

const violations = []

section('observability boundaries')

for (const probe of [
  { path: 'apps/web/src/app/providers/observability-provider.tsx', specifier: '@sentry/react' },
  {
    path: 'apps/mobile/src/app/providers/observability-provider.tsx',
    specifier: '@sentry/react-native',
  },
  {
    path: 'apps/api/internal/platform/observability/sentry.go',
    specifier: 'github.com/getsentry/sentry-go',
  },
]) {
  const probePath = join(root, probe.path)
  if (!existsSync(probePath)) {
    violations.push(`${probe.path}: observability boundary probe file is missing`)
    continue
  }
  const source = readFileSync(probePath, 'utf8')
  if (!hasForbiddenSpecifier(source, probe.specifier)) {
    violations.push(
      `${probe.path}: observability boundary probe expected ${probe.specifier} import here`,
    )
  }
}

if (process.argv.includes('--probe')) {
  // The anchors above prove the DETECTOR works on real content. This proves the RULE does: an
  // offender at a non-allowlisted path must be reported, and the allowlist must be narrow enough that
  // it only spares the boundary file it names. Without the second half an over-broad allowlist would
  // pass silently, which is the half a liveness anchor cannot see.
  const web = checks.find((check) => check.dir === 'apps/web/src')
  const cmd = checks.find((check) => check.dir === 'apps/api/cmd')
  const source = `import * as Sentry from '@sentry/react'\n`
  const cases = [
    ['apps/web/src/features/write-diary/ui/WriteDiary.tsx', web, source, true],
    ['apps/web/src/app/providers/observability-provider.tsx', web, source, false],
    // A path that only LOOKS like the allowlisted one — the anchored pattern must not spare it.
    ['apps/web/src/app/providers/observability-provider.backup.tsx', web, source, true],
    ['apps/api/cmd/api/main.go', cmd, `import "github.com/getsentry/sentry-go"\n`, true],
  ]
  const wrong = []
  for (const [path, check, text, shouldReport] of cases) {
    if (!check) {
      wrong.push(`${path}: no check covers its directory`)
      continue
    }
    const reported = boundaryViolations(check, path, text).length > 0
    if (reported !== shouldReport) {
      wrong.push(`${path}: reported=${reported}, want ${shouldReport}`)
    }
  }
  if (wrong.length > 0) console.error(wrong.join('\n'))
  if (wrong.length > 0) fail('the observability boundary rule does not behave as documented')
  ok(`${cases.length} case(s): offenders reported, the named boundary file spared, lookalikes not`)
  process.exit(0)
}

for (const check of checks) {
  const dir = join(root, check.dir)
  if (!existsSync(dir)) continue
  for (const file of walk(dir, check.extensions)) {
    const rel = relative(root, file).replaceAll('\\', '/')
    violations.push(...boundaryViolations(check, rel, readFileSync(file, 'utf8')))
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  fail('observability boundary guard failed')
}

ok('vendor SDK imports stay at the platform/app observability boundary')

// The rule for ONE file. Split out so the probe can prove both halves: that a forbidden import in a
// non-allowlisted path is reported, and that the allowlist is not so broad it waves one through.
export function boundaryViolations(check, relativePath, source) {
  if (check.allowed.some((pattern) => pattern.test(relativePath))) return []
  return check.forbidden
    .filter((forbidden) => hasForbiddenSpecifier(source, forbidden))
    .map(
      (forbidden) =>
        `${relativePath}: direct ${forbidden} import is only allowed at the platform/app observability boundary`,
    )
}

function* walk(dir, extensions) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'gen') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path, extensions)
    else if (extensions.some((extension) => entry.name.endsWith(extension))) yield path
  }
}

function hasForbiddenSpecifier(source, forbidden) {
  const literalPattern = /(["'`])([^"'`]+)\1/g
  for (const match of source.matchAll(literalPattern)) {
    const specifier = match[2]
    if (specifier === forbidden || specifier.startsWith(`${forbidden}/`)) return true
  }
  return false
}
