import {
  createMemoryClient,
  type ApiTransport,
  type SyncStatusResponse,
} from '@cosimosi/api-client'

// features/sync-status api ([R1a], A1): the server-authoritative "does a recall need consent to
// advance the clock" read. The consent decision is driven by `needsSync` from the SERVER clock —
// never a local Date — so a client just past/before UTC midnight, or with a skewed clock, can
// neither bypass nor spuriously require the sync-consent gate. Free/GET-eligible; a recall or
// whole-diary recall that advances the clock invalidates it alongside GetUniverse so the next read
// reflects the moved clock. The reactive widget read uses createSyncStatusQueryOptions; this
// imperative wrapper is the one-shot read (e.g. a diary deep-link) + the test seam.
export async function requestSyncStatus(transport: ApiTransport): Promise<SyncStatusResponse> {
  return createMemoryClient(transport).syncStatus({})
}
