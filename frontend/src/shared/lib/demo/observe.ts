// 데모 우주 관찰 셀렉터(spec 19) — 시뮬레이션 패널이 가리킬 대표 별/엣지를 고른다.
// 활성 페르소나로 시드된 별·시냅스(demoStars/demoSynapses)에서 파생만 한다(새 데이터·새 로직
// 없음, id만 노출). 좌표·three 의존 없음(순수, 헌법 §4). 별이 없으면 안전 폴백.
import { demoStars, demoSynapses } from './data'

const ageOf = (iso: string): number => {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : 0
}

/** 가장 최근(lastRecalled 최신) = 가장 밝은 별 — "엔그램=별" 앵커. */
export function brightestStarId(): string {
  const stars = demoStars()
  if (stars.length === 0) return ''
  return stars.reduce((best, s) =>
    ageOf(s.lastRecalledAt) > ageOf(best.lastRecalledAt) ? s : best,
  ).memoryId
}

/** weight 최대 엣지 — 헵 강화 앵커("이 두 별을 오가 보세요"). */
export function thickestEdge(): { aId: string; bId: string } {
  const edges = demoSynapses()
  if (edges.length === 0) return { aId: '', bId: '' }
  const e = edges.reduce((max, ed) => (ed.weight > max.weight ? ed : max))
  return { aId: e.aId, bId: e.bId }
}

/** 시냅스 시간창 앵커 — 같은 일기에서 태어난 조각 쌍(intra_entry = 같은 날). 가장 강한 것. */
export function sameDayPair(): { aId: string; bId: string } | null {
  const intra = demoSynapses().filter((e) => e.linkType === 'intra_entry')
  if (intra.length === 0) return null
  const e = intra.reduce((max, ed) => (ed.weight > max.weight ? ed : max))
  return { aId: e.aId, bId: e.bId }
}

/** 가장 오래된(lastRecalled 가장 옛날) 잠든 별 — 침묵 엔그램 앵커. */
export function dormantStarId(): string {
  const stars = demoStars()
  if (stars.length === 0) return ''
  return stars.reduce((old, s) => (ageOf(s.lastRecalledAt) < ageOf(old.lastRecalledAt) ? s : old))
    .memoryId
}
