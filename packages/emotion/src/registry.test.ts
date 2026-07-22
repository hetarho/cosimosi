import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { assertCompletePalette } from './palette.ts'
import {
  DEFAULT_PALETTE_ID,
  PALETTES,
  listPalettes,
  paletteById,
  paletteIds,
  resolvePaletteById,
} from './registry.ts'
import { defaultMoodPalette } from './palette.ts'

describe('palette registry', () => {
  it('registers at least two palettes, each complete over all 13 moods', () => {
    const entries = Object.values(PALETTES)

    expect(entries.length).toBeGreaterThanOrEqual(2)
    for (const palette of entries) {
      expect(() => assertCompletePalette(palette)).not.toThrow()
    }
  })

  it('registers the default under its stable id without re-authoring it', () => {
    expect(PALETTES[DEFAULT_PALETTE_ID]).toBe(defaultMoodPalette)
    expect(paletteById(DEFAULT_PALETTE_ID)).toBe(defaultMoodPalette)
  })

  it('falls back to the default palette for an unknown id', () => {
    expect(paletteById('does-not-exist')).toBe(defaultMoodPalette)
    expect(paletteById('')).toBe(defaultMoodPalette)
    expect(resolvePaletteById('does-not-exist')).toEqual({
      id: DEFAULT_PALETTE_ID,
      palette: defaultMoodPalette,
    })
  })

  it('lists every registered palette as an { id, name } pair', () => {
    const listed = listPalettes()

    expect(listed).toHaveLength(Object.keys(PALETTES).length)
    for (const { id, name } of listed) {
      expect(PALETTES[id]).toBeDefined()
      expect(name).toBe(PALETTES[id].name)
    }
  })

  // The TS half of the id sync guard: the registry's id set must equal the canonical fixture the
  // backend allow-list mirrors byte-for-byte. If a palette is added/removed without updating the
  // fixture (and the Go mirror), one of the two suites fails and the drift is caught.
  it('matches the canonical id fixture the backend allow-list mirrors', () => {
    const fixturePath = fileURLToPath(new URL('../fixtures/palette-ids.json', import.meta.url))
    const fixtureIds = JSON.parse(readFileSync(fixturePath, 'utf8')) as string[]

    expect([...fixtureIds].sort()).toEqual([...paletteIds()])
    expect(fixtureIds).toContain(DEFAULT_PALETTE_ID)
  })

  // The TS and Go fixtures must be byte-identical — otherwise updating only the TS copy would pass
  // both suites while the backend allow-list drifts, letting the frontend offer a palette the server
  // rejects. The Docker BE gate can't read packages/, so this cross-check lives here (repo-wide fs).
  it('keeps the backend allow-list fixture byte-identical to the registry fixture', () => {
    const tsFixture = fileURLToPath(new URL('../fixtures/palette-ids.json', import.meta.url))
    const goFixture = fileURLToPath(
      new URL('../../../apps/api/internal/account/testdata/palette-ids.json', import.meta.url),
    )
    expect(readFileSync(goFixture, 'utf8')).toEqual(readFileSync(tsFixture, 'utf8'))
  })
})
