import { useQuery } from '@tanstack/react-query'

import type { ProvenanceEntry } from '../model/provenance.ts'

// The GetProvenance read (owned by the provenance-export unit) has no Connect client yet. This
// adapter is the seam: it resolves the empty history so the 변천사 view renders its no-history
// state, and the owning unit later rebinds it to the real NO_SIDE_EFFECTS read + proto→domain map
// with no ui/widget change (taking the memory id the query key already carries). The read
// synthesizes the created baseline (CC5); the panel renders whatever ordered list it returns and
// does not know that rule. Shares its shape verbatim with the web fork (§3.5).
export async function fetchProvenance(): Promise<ProvenanceEntry[]> {
  return []
}

export function provenanceQueryKey(episodicMemoryId: string) {
  return ['provenance', episodicMemoryId] as const
}

// Fetched via Query when the 변천사 view is entered (enabled only then), so opening the panel to
// meta does not read; the result is cached per memory id.
export function useProvenanceQuery(episodicMemoryId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: provenanceQueryKey(episodicMemoryId ?? ''),
    queryFn: () => fetchProvenance(),
    enabled: enabled && Boolean(episodicMemoryId),
  })
}
