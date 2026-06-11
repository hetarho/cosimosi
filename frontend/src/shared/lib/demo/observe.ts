// 데모 우주 관찰 셀렉터(spec 19) — 시뮬레이션 패널이 가리킬 대표 별/엣지를 고른다.
// 기존 DEMO_ENTRIES/DEMO_EDGES에서 파생만 하고(새 데이터·새 로직 없음), id만 노출한다
// (좌표·three 의존 없음 — 순수, 헌법 §4).
import { DEMO_ENTRIES, DEMO_EDGES } from './data'

/** 가장 최근(daysAgo 최소) = 가장 밝은 별 — "엔그램=별" 앵커. */
export function brightestStarId(): string {
  return DEMO_ENTRIES.reduce((min, e) => (e.daysAgo < min.daysAgo ? e : min)).id
}

/** weight 최대 엣지 — 헵 강화 앵커("이 두 별을 오가 보세요"). */
export function thickestEdge(): { aId: string; bId: string } {
  const e = DEMO_EDGES.reduce((max, ed) => (ed.weight > max.weight ? ed : max))
  return { aId: e.a, bId: e.b }
}

/** 시냅스 시간창 앵커 — temporal 엣지 중 두 일기의 작성 시점이 가장 가까운 페어. */
export function sameDayPair(): { aId: string; bId: string } | null {
  const dayOf = new Map(DEMO_ENTRIES.map((e) => [e.id, e.daysAgo]))
  let best: { aId: string; bId: string } | null = null
  let bestGap = Infinity
  for (const e of DEMO_EDGES) {
    if (e.linkType !== 'temporal') continue
    const a = dayOf.get(e.a)
    const b = dayOf.get(e.b)
    if (a == null || b == null) continue
    const gap = Math.abs(a - b)
    if (gap < bestGap) {
      bestGap = gap
      best = { aId: e.a, bId: e.b }
    }
  }
  return best
}

/** 가장 오래된(daysAgo 최대) 잠든 별 — 침묵 엔그램 앵커. */
export function dormantStarId(): string {
  return DEMO_ENTRIES.reduce((max, e) => (e.daysAgo > max.daysAgo ? e : max)).id
}
