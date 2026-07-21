import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createMemoryClient } from '@cosimosi/api-client'

import type { ProvenanceEntry, ProvenanceKind, ProvenanceSource } from '../model/provenance.ts'

type MemoryClient = ReturnType<typeof createMemoryClient>

// The wire shape this adapter maps from — the fields the panel renders, narrowed onto the FE model's
// closed enums. Kept structural so the mapper is testable without a Connect message instance. Shares
// its shape verbatim with the web fork (§3.5).
interface WireProvenanceEntry {
  readonly kind: string
  readonly source: string
  readonly text: string
  readonly universeTime: string
}

// Maps the GetProvenance response entries onto the FE read model, in arrival order — the read already
// returns them baseline-first, universe-time ordered; the panel does not learn the baseline-synthesis
// rule ([R8a], CC5). kind/source are the backend's closed enums, cast onto the model's unions.
export function mapProvenanceEntries(entries: readonly WireProvenanceEntry[]): ProvenanceEntry[] {
  return entries.map((entry) => ({
    kind: entry.kind as ProvenanceKind,
    source: entry.source as ProvenanceSource,
    text: entry.text,
    universeTime: entry.universeTime,
  }))
}

// The real GetProvenance read (NO_SIDE_EFFECTS, free) over the generated Connect client + proto→domain
// map, taking the memory id the query key carries. The read synthesizes the created baseline (CC5); the
// panel renders whatever ordered list it returns and does not know that rule.
export async function fetchProvenance(
  client: MemoryClient,
  episodicMemoryId: string,
): Promise<ProvenanceEntry[]> {
  const response = await client.getProvenance({ episodicMemoryId })
  return mapProvenanceEntries(response.entries)
}

export function provenanceQueryKey(episodicMemoryId: string) {
  return ['provenance', episodicMemoryId] as const
}

interface ProvenanceQuerySnapshot {
  readonly data: readonly ProvenanceEntry[] | undefined
  readonly isPending: boolean
  readonly isError: boolean
  readonly isFetching: boolean
  readonly isFetched: boolean
}

export function provenanceQueryStatus(
  query: ProvenanceQuerySnapshot,
): 'loading' | 'retrying' | 'error' | 'success' {
  if (query.isFetching && (query.isError || (query.data === undefined && query.isFetched))) {
    return 'retrying'
  }
  if (query.isPending) return 'loading'
  if (query.isError) return 'error'
  return 'success'
}

// Fetched via Query when the 변천사 view is entered (enabled only then), so opening the panel to
// meta does not read; the result is cached per memory id.
export function useProvenanceQuery(episodicMemoryId: string | null, enabled: boolean) {
  const transport = useTransport()
  const query = useQuery({
    queryKey: provenanceQueryKey(episodicMemoryId ?? ''),
    queryFn: () => fetchProvenance(createMemoryClient(transport), episodicMemoryId ?? ''),
    enabled: enabled && Boolean(episodicMemoryId),
  })
  return {
    entries: query.data ?? [],
    status: provenanceQueryStatus(query),
    retry: () => query.refetch().then(() => undefined),
  }
}
