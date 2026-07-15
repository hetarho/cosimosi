import { describe, expect, it } from 'vitest'

import { mapProvenanceEntries } from './get-provenance.ts'

// The GetProvenance response the read returns: baseline-first, universe-time ordered, kind/source as
// the backend's bare enum strings. The adapter maps it onto the FE model verbatim, in arrival order.
const responseEntries = [
  { kind: 'created', source: 'original', text: 'the first account', universeTime: '2026-06-01' },
  { kind: 'semanticized', source: 'system', text: 'the gist', universeTime: '2026-06-10' },
  { kind: 'reconsolidated', source: 'user', text: 'the rewrite', universeTime: '2026-06-20' },
]

describe('mapProvenanceEntries', () => {
  it('maps a GetProvenance response into the ordered ProvenanceEntry[] narrowed to the closed enums', () => {
    const entries = mapProvenanceEntries(responseEntries)

    expect(entries).toEqual([
      {
        kind: 'created',
        source: 'original',
        text: 'the first account',
        universeTime: '2026-06-01',
      },
      { kind: 'semanticized', source: 'system', text: 'the gist', universeTime: '2026-06-10' },
      { kind: 'reconsolidated', source: 'user', text: 'the rewrite', universeTime: '2026-06-20' },
    ])
  })

  it('preserves arrival order and returns an empty list for an empty history', () => {
    expect(mapProvenanceEntries([])).toEqual([])
    const [first] = mapProvenanceEntries(responseEntries)
    expect(first.kind).toBe('created')
  })
})
