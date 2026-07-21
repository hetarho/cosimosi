import { describe, expect, it, vi } from 'vitest'

import { fetchProvenance, mapProvenanceEntries, provenanceQueryStatus } from './get-provenance.ts'

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

  it('preserves a transport error and maps the synthesized baseline after retry', async () => {
    const getProvenance = vi
      .fn()
      .mockRejectedValueOnce(new Error('transport unavailable'))
      .mockResolvedValueOnce({ entries: [responseEntries[0]] })
    const client = { getProvenance } as unknown as Parameters<typeof fetchProvenance>[0]

    await expect(fetchProvenance(client, 'memory-1')).rejects.toThrow('transport unavailable')
    await expect(fetchProvenance(client, 'memory-1')).resolves.toEqual([responseEntries[0]])
    expect(getProvenance).toHaveBeenNthCalledWith(1, { episodicMemoryId: 'memory-1' })
    expect(getProvenance).toHaveBeenNthCalledWith(2, { episodicMemoryId: 'memory-1' })
  })

  it('distinguishes the actual no-data manual-refetch flags from an initial load', () => {
    expect(
      provenanceQueryStatus({
        data: undefined,
        isPending: true,
        isError: false,
        isFetching: true,
        isFetched: false,
      }),
    ).toBe('loading')
    expect(
      provenanceQueryStatus({
        data: undefined,
        isPending: true,
        isError: false,
        isFetching: true,
        isFetched: true,
      }),
    ).toBe('retrying')
    expect(
      provenanceQueryStatus({
        data: [mapProvenanceEntries(responseEntries)[0]],
        isPending: false,
        isError: true,
        isFetching: true,
        isFetched: true,
      }),
    ).toBe('retrying')
    expect(
      provenanceQueryStatus({
        data: undefined,
        isPending: false,
        isError: true,
        isFetching: false,
        isFetched: true,
      }),
    ).toBe('error')
    expect(
      provenanceQueryStatus({
        data: [],
        isPending: false,
        isError: false,
        isFetching: false,
        isFetched: true,
      }),
    ).toBe('success')
  })
})
