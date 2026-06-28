import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()

const checks = [
  {
    dir: 'apps/web/src',
    extensions: ['.ts', '.tsx'],
    forbidden: ['@sentry/react', '@sentry/browser', '@sentry/core', 'posthog-js'],
    allowed: [/^apps\/web\/src\/app\/observability-provider\.tsx$/],
  },
  {
    dir: 'apps/mobile/src',
    extensions: ['.ts', '.tsx'],
    forbidden: ['@sentry/react-native', 'posthog-react-native'],
    allowed: [/^apps\/mobile\/src\/app\/observability-provider\.tsx$/],
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
  process.exit(1)
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
