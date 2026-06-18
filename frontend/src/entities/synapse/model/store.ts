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
  /** 공동 회상 횟수(spec 26) — proto 신규 필드. 데모/구버전 응답엔 없어 0이 기본. */
  coActivationCount?: number
}

const LINK_TYPES: LinkType[] = ['semantic', 'temporal', 'entity', 'co_recall']

/** proto synapse → domain SynapseEdge. brightness defaults to 1 and
 *  reinforcedRecency to 0 until real activation derives them; coActivationCount
 *  rides through from the server (0 when absent — demo/older responses). */
export function toSynapseEdge(s: UniverseSynapse): SynapseEdge {
  return {
    aId: s.aId,
    bId: s.bId,
    weight: s.weight,
    brightness: 1,
    reinforcedRecency: 0,
    coActivationCount: s.coActivationCount ?? 0,
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
          coActivationCount: 1, // first co-recall (mirrors server ReinforceLinks new-row count)
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
        coActivationCount: edges[i].coActivationCount + 1, // ++ on conflict (mirrors server)
        lastActivatedAt: now,
      }
      return { edges }
    }),
}))

/** Pure: edges incident to memoryId (for neighbor navigation). */
export function neighborsOf(edges: SynapseEdge[], memoryId: string): SynapseEdge[] {
  return edges.filter((e) => e.aId === memoryId || e.bId === memoryId)
}

/** Pure: the edges INTERNAL to a star set — both endpoints in `ids` (spec 28). For a diary's
 *  star set these are its within-event (일내) connections: the intra_entry links spec 21 wrote
 *  to bind the fragments, plus any later same-diary links. (We test set-membership, not the
 *  link_type string: toSynapseEdge collapses the server's 'intra_entry' to 'semantic', so
 *  membership is the reliable signal.) Wayfinding highlights these brighter while the rest of
 *  the web dims. three/DOM-free (헌법4). */
export function edgesWithin(edges: SynapseEdge[], ids: ReadonlySet<string>): SynapseEdge[] {
  if (ids.size === 0) return []
  return edges.filter((e) => ids.has(e.aId) && ids.has(e.bId))
}

/** Pure: per-node value map normalized by the universe MEDIAN (median 0 → 1 fallback so the
 *  ratio stays finite). Each edge contributes `edgeValue(e)` to BOTH endpoints in one pass; the
 *  typical node sits at ~1 and a hub rises above it. Nodes with no edges are absent from the map →
 *  callers read 0. three/DOM-free (헌법4). degree·weighted-degree share this(중복 제거). */
function normalizedNodeMap(edges: SynapseEdge[], edgeValue: (e: SynapseEdge) => number): Map<string, number> {
  const acc = new Map<string, number>()
  for (const e of edges) {
    const v = edgeValue(e)
    acc.set(e.aId, (acc.get(e.aId) ?? 0) + v)
    acc.set(e.bId, (acc.get(e.bId) ?? 0) + v)
  }
  if (acc.size === 0) return acc
  const sorted = [...acc.values()].sort((x, y) => x - y)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const denom = median > 0 ? median : 1
  const out = new Map<string, number>()
  for (const [id, d] of acc) out.set(id, d / denom)
  return out
}

/** star id → degree(인접 간선 수)를 median으로 정규화(spec 26 R_conn 입력). 보통 별 ~1, 허브는 그 위. */
export function degreeNormById(edges: SynapseEdge[]): Map<string, number> {
  return normalizedNodeMap(edges, () => 1)
}

/** star id → Σ(인접 링크 weight)를 median으로 정규화(spec 03 self-glow 연결성 입력). 강한 링크 허브가
 *  약한 허브보다 무겁고, 가지친 링크(weight→floor)도 작게 잔존 기여(헌법2·LTD). 보통 별 ~1. */
export function weightedDegreeById(edges: SynapseEdge[]): Map<string, number> {
  return normalizedNodeMap(edges, (e) => e.weight)
}
