// Pure synapse visual domain types. No three/React/DOM (mobile reusable). Coordinates are
// NOT here (received via positionOf; star coords emerge client-side).

export type LinkType = 'semantic' | 'temporal' | 'entity' | 'co_recall'

const LINK_TYPES = new Set<string>(['semantic', 'temporal', 'entity', 'co_recall'])

export function isLinkType(value: unknown): value is LinkType {
  return typeof value === 'string' && LINK_TYPES.has(value)
}

export function parseLinkType(value: unknown, fallback: LinkType = 'semantic'): LinkType {
  return isLinkType(value) ? value : fallback
}

export interface SynapseEdge {
  /** normalized a_id < b_id (one undirected row). */
  aId: string
  bId: string
  /** 0..1 synapse strength (server-authoritative graph). */
  weight: number
  /** = max(a_min, activation); an input here. */
  brightness: number
  /** 0..1 recent-reinforcement (drives pulse amplitude; produced by 11/12). */
  reinforcedRecency: number
  linkType: LinkType
  /** epoch ms of last activation — brightness re-derives from this on refetch merge
   *  (16) so decay progresses instead of max()-freezing at first-load brightness. */
  lastActivatedAt?: number
  /** 공동 회상 횟수(spec 26) — 서버 memory_links.co_activation_count를 그대로 운반. 링크
   *  활력(자주 함께 떠올린 연결일수록 또렷)을 시각에 반영하고 27 가지치기 입력으로 노출. */
  coActivationCount: number
}
