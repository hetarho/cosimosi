// 별(기억) 스킨 — 단일 축 "형태(look)" 3종 카탈로그(spec 53 / change 29). form×surface 2축(spec 52)을 폐기하고
// 사용자가 고르는 단위를 하나의 룩으로 통합한다: 다면체·액체→구름·고슴도치. 각 룩은 모양+질감(+추상화 단계
// 변형)을 한 덩어리로 정의한다. 색은 항상 mood(감정 의미색)라 룩은 형태/질감만 바꾼다(plan 44 색 규칙 불변).
// 선택 wire(star_object)는 이제 룩 id 하나다(합성 "form+surface" 폐기) — 미지/레거시 값은 디폴트 룩으로 폴백.
// 룩별 추상화-단계 지오메트리(다면체 20→12→8→4·고슴도치 가시 감쇠·액체→구름)는 ui/star-body의 buildStarBody(look,
// stage)가, 단계별 버킷 렌더는 ui/StarField가 맡는다.

/** 사용자가 고르는 단일 축 별 형태(룩). 무료 = polyhedron. */
export type StarLook = 'polyhedron' | 'liquid' | 'spiky'

/** 룩 카탈로그 한 항목의 메타 — 스위처 피커가 소비(id/이름/설명/미리보기 swatch). */
export interface StarLookMeta {
  id: StarLook
  name: string
  tagline: string
  swatch: string
}

/** 룩 카탈로그 — 노출 순서이자 단일 출처. 추상화가 진행되면 단계별로 또렷이 변형된다(Phase 2). */
export const STAR_LOOKS: StarLookMeta[] = [
  {
    id: 'polyhedron',
    name: '다면체',
    tagline: '각진 결정 — 잊혀갈수록 면이 줄어든다(20→4면)',
    swatch: 'conic-gradient(from 30deg at 50% 50%, #2a3a66, #0a0e1e, #3a4a76, #0a0e1e, #2a3a66)',
  },
  {
    id: 'liquid',
    name: '액체 → 구름',
    tagline: '출렁이는 구슬 — 잊혀갈수록 투명해져 구름처럼 흩어진다',
    swatch: 'conic-gradient(from 210deg at 50% 50%, #ffb27a, #ff5fa0, #9b7bff, #5fd0c0, #ffb27a)',
  },
  {
    id: 'spiky',
    name: '고슴도치',
    tagline: '뾰족한 가시 — 잊혀갈수록 가시가 듬성해져 매끈한 다각형으로',
    swatch: 'radial-gradient(circle at 50% 50%, #ffd27a 0%, #ef5a2a 42%, #2a0a04 100%)',
  },
]

export const DEFAULT_STAR_LOOK: StarLook = 'polyhedron'
/** 선택 wire 기본값(star_object) — 이제 룩 id다. */
export const DEFAULT_STAR_SELECTION: StarLook = DEFAULT_STAR_LOOK

const STAR_LOOK_IDS = new Set<string>(STAR_LOOKS.map((l) => l.id))

/** 임의 입력 → 유효 룩(미지·레거시·빈 값은 디폴트, 크래시 없음 — change 29: 폴백만, 레거시 호환 불필요). */
export function parseStarLook(value: unknown, fallback: StarLook = DEFAULT_STAR_LOOK): StarLook {
  return typeof value === 'string' && STAR_LOOK_IDS.has(value) ? (value as StarLook) : fallback
}

/** 저장/하이드레이트/서버 시드 경계 정규화 — 항상 유효 룩 id를 돌려준다. */
export function normalizeStarLook(value: unknown): StarLook {
  return parseStarLook(value)
}
