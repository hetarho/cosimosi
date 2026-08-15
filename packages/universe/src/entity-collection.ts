import { sameFacts } from '@cosimosi/memory'

/**
 * Shared by the three GetUniverse entity stores (§3.2): does a `setAll` write actually change
 * anything?
 *
 * Each read allocates fresh domain records, so a store that writes unconditionally hands every
 * downstream memo a new `byId`/`ids` identity on a refetch that carried identical facts — and those
 * identities are what rebuild the projected graph, the instance-channel buffers and the sim. The
 * check walks the incoming array against the store's `ids` by index, so a backend reorder of the same
 * rows still counts as a change: slot order is what the coordinate buffer is laid out by.
 */
export function sameStoredCollection<T extends { readonly id: string }>(
  ids: readonly string[],
  byId: Readonly<Record<string, T>>,
  next: readonly T[],
): boolean {
  if (ids.length !== next.length) return false
  for (let index = 0; index < next.length; index += 1) {
    const incoming = next[index] as T
    if (ids[index] !== incoming.id) return false
    const current = byId[incoming.id]
    if (current === undefined || !sameFacts(current, incoming)) return false
  }
  return true
}
