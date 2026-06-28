import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { generateValues } from './gen-values.mjs'

function createFixture(content) {
  const root = mkdtempSync(join(tmpdir(), 'cosimosi-values-'))
  const srcPath = join(root, 'values.yaml')
  const tsOut = join(root, 'packages', 'config', 'src', 'values.gen.ts')
  const goOut = join(root, 'apps', 'api', 'internal', 'platform', 'values', 'values_gen.go')
  writeFileSync(srcPath, content, 'utf8')
  return { root, srcPath, tsOut, goOut }
}

function generateFixture(t, content) {
  const fixture = createFixture(content)
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }))
  generateValues({ ...fixture, quiet: true })
  return fixture
}

test('generates deterministic TypeScript and API platform Go values', (t) => {
  const fixture = generateFixture(
    t,
    `client_cache:
  default_stale_ms: 30000
  ratios: [0.25, 1, 2.5]
  label: stable
  tier_prices:
    free: 0
    plus: 12.5
  aliases:
    primary: main
    secondary: support
`,
  )

  const firstTs = readFileSync(fixture.tsOut, 'utf8')
  const firstGo = readFileSync(fixture.goOut, 'utf8')
  generateValues({ ...fixture, quiet: true })

  assert.equal(readFileSync(fixture.tsOut, 'utf8'), firstTs)
  assert.equal(readFileSync(fixture.goOut, 'utf8'), firstGo)
  assert.match(firstTs, /export const VALUES = \{/)
  assert.match(firstTs, /clientCache: \{[\s\S]*defaultStaleMs: 30000,/)
  assert.match(firstGo, /package values/)
  assert.match(firstGo, /ClientCacheDefaultStaleMs\s+= 30000/)
  assert.match(firstGo, /ClientCacheRatios\s+= \[]float64\{0.25, 1, 2.5\}/)
  assert.match(firstGo, /ClientCacheTierPrices = map\[string]float64/)
  assert.match(firstGo, /ClientCacheAliases = map\[string]string/)
})

const invalidFixtures = [
  {
    name: 'non-finite numbers',
    yaml: `client_cache:
  bad_value: .inf
`,
    error: /client_cache\.bad_value must be finite/,
  },
  {
    name: 'invalid group casing',
    yaml: `clientCache:
  default_stale_ms: 1
`,
    error: /group "clientCache" must be snake_case/,
  },
  {
    name: 'invalid key casing',
    yaml: `client_cache:
  defaultStaleMs: 1
`,
    error: /key "defaultStaleMs" must be snake_case/,
  },
  {
    name: 'unsupported nested arrays',
    yaml: `client_cache:
  bad_values:
    - [1, 2]
`,
    error: /numeric arrays must contain only finite numbers/,
  },
  {
    name: 'unsupported nested maps',
    yaml: `client_cache:
  bad_table:
    tier:
      price: 1
`,
    error: /must be a one-level scalar map/,
  },
  {
    name: 'invalid scalar map key casing',
    yaml: `client_cache:
  tier_prices:
    Free: 0
`,
    error: /scalar map key "Free" must be snake_case/,
  },
  {
    name: 'TypeScript group name collisions',
    yaml: `foo_1:
  value: 1
foo1:
  value: 2
`,
    error: /foo1 generates duplicate TypeScript group name "foo1" already used by foo_1/,
  },
  {
    name: 'TypeScript key name collisions',
    yaml: `client_cache:
  retry_1: 1
  retry1: 2
`,
    error: /client_cache\.retry1 generates duplicate TypeScript key name "retry1" already used by client_cache\.retry_1/,
  },
  {
    name: 'Go constant name collisions',
    yaml: `foo:
  bar_baz: 1
foo_bar:
  baz: 2
`,
    error: /foo_bar\.baz generates duplicate Go constant name "FooBarBaz" already used by foo\.bar_baz/,
  },
]

for (const fixtureCase of invalidFixtures) {
  test(`rejects ${fixtureCase.name}`, (t) => {
    const fixture = createFixture(fixtureCase.yaml)
    t.after(() => rmSync(fixture.root, { recursive: true, force: true }))

    assert.throws(() => generateValues({ ...fixture, quiet: true }), fixtureCase.error)
  })
}
