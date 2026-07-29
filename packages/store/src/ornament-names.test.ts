import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { DEFAULT_ORNAMENT_IDS, ORNAMENT_KINDS } from './ornament.ts'
import { ORNAMENT_NAMES } from './ornament-names.ts'

// The third reader of the one id fixture (the Go catalog and the renderer registries are the other
// two). A row the server serves with no name here would render as a bare id, and a name for an id
// nobody serves is dead copy — both are caught by the same file.
const fixture = JSON.parse(
  readFileSync(
    new URL('../../../apps/api/internal/store/testdata/ornament-ids.json', import.meta.url),
    'utf8',
  ),
) as { readonly defaults: Record<string, string>; readonly ids: Record<string, readonly string[]> }

describe('ornament names', () => {
  it('names every published id and nothing else', () => {
    const published = ORNAMENT_KINDS.flatMap((kind) => fixture.ids[kind] ?? []).sort()
    expect(Object.keys(ORNAMENT_NAMES).sort()).toEqual(published)
  })

  it('keeps each kind default equal to the fixture', () => {
    for (const kind of ORNAMENT_KINDS) {
      expect(DEFAULT_ORNAMENT_IDS[kind]).toBe(fixture.defaults[kind])
    }
  })

  it('resolves every name to non-empty copy', () => {
    for (const [id, name] of Object.entries(ORNAMENT_NAMES)) {
      expect(name(), id).not.toBe('')
    }
  })
})
