// Refetch → render-store merge (spec 16 §동기화=병합). A GetUniverse refetch must NOT
// replace the star/edge sets wholesale: that would drop mid-submit temp stars, shuffle
// instance slots (coordinates derive from array position — constitution §3), and roll
// back locally-advanced timestamps/weights. Both merges are append-monotone (nothing is
// ever removed — constitution §2) and conflict-free by max(): MVP server changes are
// monotonic (weight grows, timestamps advance), so max(server, local) is exact.
// v1+ bidirectional reconsolidation (#23) makes weights non-monotonic — revisit then.
// Pure: no three/React/DOM (ESLint pure layer), unit-tested in merge.test.ts.
import type { SynapseEdge } from '@/entities/synapse/@x/memory'
import { starBrightness } from './activation'
import type { StarNode } from './types'

/** Undirected pair key; normalizes defensively (server already sends a_id < b_id). */
function edgeKey(e: SynapseEdge): string {
  return e.aId < e.bId ? `${e.aId}|${e.bId}` : `${e.bId}|${e.aId}`
}

/**
 * Merge an incoming (server) star set into the local render set, keyed by memory id.
 * - Existing stars keep their OBJECT IDENTITY (slot `index`, seed, emergent position)
 *   unless the server's lastRecalledAt is ahead — then only that field advances (max).
 * - Local-only stars are kept: `temp-` optimistic stars (replaceStar owns their swap)
 *   and just-confirmed stars a stale response doesn't include yet.
 * - Server-only stars are appended at the end → next free instance slots.
 * Returns the SAME array reference when nothing changed (skips a re-render/rebuild).
 */
export function mergeStars(local: StarNode[], incoming: StarNode[]): StarNode[] {
  const incomingById = new Map(incoming.map((n) => [n.id, n]))
  let changed = false
  const merged = local.map((node) => {
    const inc = incomingById.get(node.id)
    if (!inc) return node
    incomingById.delete(node.id)
    const lastRecalledAt = Math.max(node.memory.lastRecalledAt, inc.memory.lastRecalledAt)
    if (lastRecalledAt === node.memory.lastRecalledAt) return node
    changed = true
    return { ...node, memory: { ...node.memory, lastRecalledAt } }
  })
  const appended = [...incomingById.values()].map((n, k) => ({ ...n, index: local.length + k }))
  if (!changed && appended.length === 0) return local
  return [...merged, ...appended]
}

/**
 * Merge an incoming (server) synapse set into the local edge set, keyed by the
 * undirected (aId, bId) pair. weight/reinforcedRecency take max(server, local) so a
 * refetch racing an un-flushed reinforce batch never thins or dims an edge the user
 * just strengthened (visual non-regression; the next flush converges). brightness
 * re-derives from max(lastActivatedAt) at the injected `now` — taking max(brightness)
 * instead would compare values computed at different wall-clock times and freeze decay
 * at first-load level for the whole session. (Idle-tab staleness between merges remains
 * a spec-09 limitation: synapse brightness is baked at sync, not derived per frame.)
 * Local-only edges are kept; server-only edges are appended.
 * Returns the SAME array reference when nothing changed.
 */
export function mergeEdges(
  local: SynapseEdge[],
  incoming: SynapseEdge[],
  now: number,
): SynapseEdge[] {
  const incomingByKey = new Map(incoming.map((e) => [edgeKey(e), e]))
  let changed = false
  const merged = local.map((edge) => {
    const key = edgeKey(edge)
    const inc = incomingByKey.get(key)
    if (!inc) return edge
    incomingByKey.delete(key)
    const weight = Math.max(edge.weight, inc.weight)
    const reinforcedRecency = Math.max(edge.reinforcedRecency, inc.reinforcedRecency)
    const ts = Math.max(edge.lastActivatedAt ?? 0, inc.lastActivatedAt ?? 0)
    const lastActivatedAt = ts > 0 ? ts : undefined
    // 타임스탬프를 아는 쪽이 하나라도 있으면 거기서 재파생(감쇠 진행), 없으면 max 폴백.
    const brightness =
      lastActivatedAt != null
        ? starBrightness(lastActivatedAt, now)
        : Math.max(edge.brightness, inc.brightness)
    if (
      weight === edge.weight &&
      brightness === edge.brightness &&
      reinforcedRecency === edge.reinforcedRecency &&
      lastActivatedAt === edge.lastActivatedAt
    ) {
      return edge
    }
    changed = true
    return { ...edge, weight, brightness, reinforcedRecency, lastActivatedAt }
  })
  const appended = [...incomingByKey.values()]
  if (!changed && appended.length === 0) return local
  return [...merged, ...appended]
}
