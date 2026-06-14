// The single authoritative star store for rendering. zustand holds StarNode[] —
// NOT coordinates: positions come from the force-sim Float32Array, subscribed by ref
// in the ui to avoid 60fps React re-renders (constitution §3, Architecture §2.7).
// addStar/replaceStar/removeStar drive the optimistic record flow (this store stays
// the authority, keyed on StarNode).
import { create } from 'zustand'
import type { StarNode } from './types'
import type { Ambient } from './ambient'

interface MemoryState {
  stars: StarNode[]
  /** 요즘 상태 요약(spec 25) — 서버 GetUniverse가 보낸 ambient 우선, 미수신(데모·구버전)이면
   *  로드된 별에서 파생(deriveAmbient). 다중 광원의 색 분포는 클라가 별에서 따로 만든다(원칙3).
   *  null = 아직 우주를 로드하지 않음 → 배경은 테마 베이스색만. */
  ambient: Ambient | null
  /** True once GetUniverse has hydrated an EMPTY universe for the current source —
   *  lets the renderer tell "loaded empty (a new user)" apart from "not loaded yet",
   *  so the user's FIRST diary stars get the birth animation while a normal first
   *  load of an existing universe stays un-animated (StarField). */
  loadedEmpty: boolean
  setStars: (stars: StarNode[]) => void
  setLoadedEmpty: (loadedEmpty: boolean) => void
  /** 요즘 상태 요약 설정(서버값 우선, 미수신 시 deriveAmbient 폴백 — get-universe가 호출). */
  setAmbient: (ambient: Ambient) => void
  // ── optimistic record flow (StarNode-based) ──
  /** Append a new star (e.g. an optimistic temp star); index = its slot. */
  addStar: (node: StarNode) => void
  /** Append a fragment fan-out batch (spec 21: 1 diary → N stars) in one update;
   *  each node gets the next free slot. */
  addStars: (nodes: StarNode[]) => void
  /** Swap a temp star for the server-confirmed one, keeping its slot index. */
  replaceStar: (tempId: string, node: StarNode) => void
  /** Swap a batch of temp stars for their confirmed fan-out (spec 21): tempIds
   *  are removed (only `temp-` ids — server stars are never removed, constitution
   *  §2), nodes not already present are appended, slots re-indexed. */
  replaceMany: (tempIds: string[], nodes: StarNode[]) => void
  /** Roll back a temp star only (id starts with `temp-`); server stars are never
   *  removed (constitution §2). */
  removeStar: (tempId: string) => void
}

/** Pure: the stars that came from one original diary (spec 28), in fragment order.
 *  The wayfinding group key is `recordId`; empty/blank recordId is never grouped (a
 *  star with no record key — old data — matches nothing). Used to frame + highlight a
 *  whole diary's stars (원본 일기로 별 찾기). three/DOM-free (헌법4). */
export function starsOfRecord(stars: StarNode[], recordId: string): StarNode[] {
  if (!recordId) return []
  return stars
    .filter((s) => s.memory.recordId === recordId)
    .sort((a, b) => a.memory.fragmentIndex - b.memory.fragmentIndex)
}

export const useMemoryStore = create<MemoryState>((set) => ({
  stars: [],
  loadedEmpty: false,
  ambient: null,
  setStars: (stars) => set({ stars }),
  setLoadedEmpty: (loadedEmpty) => set({ loadedEmpty }),
  setAmbient: (ambient) => set({ ambient }),
  addStar: (node) => set((s) => ({ stars: [...s.stars, { ...node, index: s.stars.length }] })),
  addStars: (nodes) =>
    set((s) => {
      // Skip ids already merged by a racing refetch (16) — same dedup reasoning
      // as replaceStar's first branch, batched.
      const known = new Set(s.stars.map((st) => st.id))
      const fresh = nodes.filter((n) => !known.has(n.id))
      if (fresh.length === 0) return s
      return { stars: [...s.stars, ...fresh.map((n, k) => ({ ...n, index: s.stars.length + k }))] }
    }),
  replaceStar: (tempId, node) =>
    set((s) => {
      // If a refetch already merged the server-confirmed star while RecordMemory was in
      // flight (16 — merge appends unknown server stars), swapping the temp would leave
      // the SAME memory rendered as two stars. Drop the temp instead (re-indexed).
      if (s.stars.some((st) => st.id === node.id)) {
        const stars = s.stars
          .filter((st) => st.id !== tempId)
          .map((st, i) => (st.index === i ? st : { ...st, index: i }))
        return { stars }
      }
      // Temp gone: merge never removes temps, so the only cause is a source-boundary
      // reset (sign-out/demo switch, 16) mid-submit — the confirmed star belongs to the
      // PREVIOUS source. Do NOT append it into the new session; the memory is committed
      // server-side and the owner's next GetUniverse shows it.
      if (!s.stars.some((st) => st.id === tempId)) return s
      return { stars: s.stars.map((st) => (st.id === tempId ? { ...node, index: st.index } : st)) }
    }),
  replaceMany: (tempIds, nodes) =>
    set((s) => {
      const removable = new Set(tempIds.filter((id) => id.startsWith('temp-'))) // §2: temps only
      const kept = s.stars.filter((st) => !removable.has(st.id))
      const known = new Set(kept.map((st) => st.id))
      const fresh = nodes.filter((n) => !known.has(n.id))
      if (removable.size === 0 && fresh.length === 0) return s
      const stars = [...kept, ...fresh].map((st, i) => (st.index === i ? st : { ...st, index: i }))
      return { stars }
    }),
  removeStar: (tempId) =>
    set((s) => {
      if (!tempId.startsWith('temp-')) return s // never remove server stars (constitution §2)
      // Re-index so index stays == array slot (filter leaves a gap otherwise).
      const stars = s.stars
        .filter((st) => st.id !== tempId)
        .map((st, i) => (st.index === i ? st : { ...st, index: i }))
      return { stars }
    }),
}))
