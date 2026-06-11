// Synapse edge store + GetUniverse mapper + neighbor selector. zustand is fine in model
// (RN-compatible); no three/DOM. brightness/reinforcedRecency default until real activation is wired.
import { create } from 'zustand'
import { virtualNowMs } from '@/shared/lib/demo'
import type { LinkType, SynapseEdge } from './types'

/** The subset of proto GetUniverse Synapse we map. */
export interface UniverseSynapse {
  aId: string
  bId: string
  weight: number
  linkType: string
  lastActivatedAt: string
}

const LINK_TYPES: LinkType[] = ['semantic', 'temporal', 'entity', 'co_recall']

/** proto synapse → domain SynapseEdge. brightness defaults to 1 and
 *  reinforcedRecency to 0 until real activation derives them. */
export function toSynapseEdge(s: UniverseSynapse): SynapseEdge {
  return {
    aId: s.aId,
    bId: s.bId,
    weight: s.weight,
    brightness: 1,
    reinforcedRecency: 0,
    linkType: (LINK_TYPES as string[]).includes(s.linkType) ? (s.linkType as LinkType) : 'semantic',
  }
}

interface SynapseState {
  edges: SynapseEdge[]
  setEdges: (edges: SynapseEdge[]) => void
  /** 페어(무방향)의 weight를 로컬로 +delta(상한 1.0)하고 방금 활성화로 갱신한다.
   *  페어가 없으면 co_recall 엣지를 로컬 생성(함께 회상 → 새 연결). 데모 헵 미리보기
   *  (spec 19)가 쓴다 — 서버 쓰기 없음, 비데모 영속 경로(11 reinforceLinks)는 불변.
   *  로컬이 앞선 weight는 refetch 병합의 max()가 보존한다(16). */
  bumpEdgeWeight: (aId: string, bId: string, delta: number) => void
}

export const useSynapseStore = create<SynapseState>((set) => ({
  edges: [],
  setEdges: (edges) => set({ edges }),
  bumpEdgeWeight: (aId, bId, delta) =>
    set((s) => {
      const [a, b] = aId < bId ? [aId, bId] : [bId, aId]
      const now = virtualNowMs()
      const i = s.edges.findIndex((e) => e.aId === a && e.bId === b)
      if (i < 0) {
        const created: SynapseEdge = {
          aId: a,
          bId: b,
          weight: Math.min(1, delta),
          brightness: 1,
          reinforcedRecency: 1,
          linkType: 'co_recall',
          lastActivatedAt: now,
        }
        return { edges: [...s.edges, created] }
      }
      const edges = [...s.edges]
      edges[i] = {
        ...edges[i],
        weight: Math.min(1, edges[i].weight + delta),
        brightness: 1,
        reinforcedRecency: 1,
        lastActivatedAt: now,
      }
      return { edges }
    }),
}))

/** Pure: edges incident to memoryId (for neighbor navigation). */
export function neighborsOf(edges: SynapseEdge[], memoryId: string): SynapseEdge[] {
  return edges.filter((e) => e.aId === memoryId || e.bId === memoryId)
}
