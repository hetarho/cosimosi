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
    forbidden: ['@sentry/react', '@sentry/react-native', '@sentry/browser', '@sentry/core', 'posthog-js', 'posthog-react-native'],
    allowed: [],
  },
  {
    dir: 'apps/api/internal',
    extensions: ['.go'],
    forbidden: ['github.com/getsentry/sentry-go'],
    allowed: [/^apps\/api\/internal\/platform\/observability\/sentry\.go$/],
  },
]

const violations = []

section('observability boundaries')

for (const probe of [
  { path: 'apps/web/src/app/providers/observability-provider.tsx', specifier: '@sentry/react' },
  { path: 'apps/mobile/src/app/providers/observability-provider.tsx', specifier: '@sentry/react-native' },
  { path: 'apps/api/internal/platform/observability/sentry.go', specifier: 'github.com/getsentry/sentry-go' },
]) {
  const probePath = join(root, probe.path)
  if (!existsSync(probePath)) {
    violations.push(`${probe.path}: observability boundary probe file is missing`)
    continue
  }
  const source = readFileSync(probePath, 'utf8')
  if (!hasForbiddenSpecifier(source, probe.specifier)) {
    violations.push(`${probe.path}: observability boundary probe expected ${probe.specifier} import here`)
  }
}

for (const check of checks) {
  for (const file of walk(join(root, check.dir), check.extensions)) {
    const rel = relative(root, file).replaceAll('\\', '/')
    if (check.allowed.some((pattern) => pattern.test(rel))) continue
    const source = readFileSync(file, 'utf8')
    for (const forbidden of check.forbidden) {
      if (hasForbiddenSpecifier(source, forbidden)) {
        violations.push(`${rel}: direct ${forbidden} import is only allowed at the platform/app observability boundary`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  fail('observability boundary guard failed')
}

ok('vendor SDK imports stay at the platform/app observability boundary')

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
