// Slice API parity (ARCH-28): a slice that exists on both apps exposes the same export names from
// its `index.ts`, so porting a slice never means relearning it. A name only one platform has must be
// listed in `scripts/slice-api-platform-only.json` as that platform's addition; a listed name that
// no longer differs is a stale entry and fails too.

import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const LAYERS = ['entities', 'features', 'widgets', 'pages']
const PLATFORM_ONLY = 'scripts/slice-api-platform-only.json'

/** Every name an entry exports: re-export lists (aliases resolved) and local declarations. */
export function sliceExportNames(source) {
  const names = new Set()
  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const part of match[1].split(',')) {
      const cleaned = part.trim().replace(/^type\s+/, '')
      if (!cleaned) continue
      names.add(
        cleaned
          .split(/\s+as\s+/)
          .pop()
          .trim(),
      )
    }
  }
  for (const match of source.matchAll(
    /export\s+(?:async\s+)?(?:function|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    names.add(match[1])
  }
  return names
}

/** Per shared slice, the names only one app exports. */
export function measureSliceApiDrift(root = repoRoot) {
  const drift = {}
  for (const layer of LAYERS) {
    const web = join(root, 'apps/web/src', layer)
    const mobile = join(root, 'apps/mobile/src', layer)
    if (!existsSync(web) || !existsSync(mobile)) continue
    for (const slice of readdirSync(web).sort()) {
      const webEntry = join(web, slice, 'index.ts')
      const mobileEntry = join(mobile, slice, 'index.ts')
      if (!existsSync(webEntry) || !existsSync(mobileEntry)) continue
      const webNames = sliceExportNames(readFileSync(webEntry, 'utf8'))
      const mobileNames = sliceExportNames(readFileSync(mobileEntry, 'utf8'))
      const webOnly = [...webNames].filter((name) => !mobileNames.has(name)).sort()
      const mobileOnly = [...mobileNames].filter((name) => !webNames.has(name)).sort()
      if (webOnly.length > 0 || mobileOnly.length > 0) {
        drift[`${layer}/${slice}`] = { web: webOnly, mobile: mobileOnly }
      }
    }
  }
  return drift
}

/** The problems a drift report has against the platform-only allowlist. */
export function compareSliceApiDrift(drift, allowed) {
  const problems = []
  for (const [slice, sides] of Object.entries(drift)) {
    for (const platform of ['web', 'mobile']) {
      const listed = new Set(allowed[platform]?.[slice] ?? [])
      for (const name of sides[platform]) {
        if (!listed.has(name)) problems.push(`${slice}: "${name}" exists only on ${platform}`)
      }
    }
  }
  for (const platform of ['web', 'mobile']) {
    for (const [slice, names] of Object.entries(allowed[platform] ?? {})) {
      const actual = new Set(drift[slice]?.[platform] ?? [])
      for (const name of names) {
        if (!actual.has(name)) problems.push(`${slice}: stale ${platform}-only entry "${name}"`)
      }
    }
  }
  return problems
}

describe('slice API parity', () => {
  it('reads re-exports, aliases and declarations as export names', () => {
    const names = sliceExportNames(
      [
        "export { A, B as C, type D } from './a.ts'",
        "export type { E } from './e.ts'",
        'export function F() {}',
        'export const G = 1',
      ].join('\n'),
    )
    assert.deepEqual([...names].sort(), ['A', 'C', 'D', 'E', 'F', 'G'])
  })

  it('reports an unlisted one-sided name and a stale listing', () => {
    const drift = { 'features/x': { web: ['Only'], mobile: [] } }
    assert.deepEqual(compareSliceApiDrift(drift, { web: {}, mobile: {} }), [
      'features/x: "Only" exists only on web',
    ])
    assert.deepEqual(compareSliceApiDrift({}, { web: { 'features/x': ['Gone'] }, mobile: {} }), [
      'features/x: stale web-only entry "Gone"',
    ])
  })

  it('keeps every shared slice on one API, platform-only additions listed', () => {
    const allowed = JSON.parse(readFileSync(join(repoRoot, PLATFORM_ONLY), 'utf8'))
    assert.deepEqual(compareSliceApiDrift(measureSliceApiDrift(), allowed), [])
  })
})
