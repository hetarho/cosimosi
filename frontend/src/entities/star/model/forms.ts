// 별(기억) 스킨의 2축 카탈로그(spec 52) — 형태(form, 지오메트리/실루엣)와 표면(surface, 셰이딩/질감)을
// 독립 선택 축으로 나눈다. 사용자가 "이 모양에 저 질감"을 따로 고른다(조합 폭발). 색은 항상 mood(감정
// 의미색)라 form/surface는 형태/질감만 바꾼다(plan 44 색 규칙 불변). 시각 조립(geometry×emissive)은
// ui/star-body가 STAR_FORMS·STAR_SURFACES registry로 한다(N-제네릭). 선택은 합성 wire id "<form>+<surface>"로
// 직렬화돼 proto/DB 스키마가 안 바뀐다 — 레거시 단일 id(deepfield 등)는 STAR_PRESETS로 (form,surface) 폴백.
import type { StarObject } from './types'

/** 형태(form) — 지오메트리/실루엣 축. lowpoly(저폴리 20면)·octa(8면체)·smooth(매끈 구)·cloudy(고분할 구)·
 *  liquid(노이즈 변위 구). 무료 = lowpoly. */
export type StarForm = 'lowpoly' | 'octa' | 'smooth' | 'cloudy' | 'liquid'
/** 표면(surface) — 셰이딩/질감 축. facet(면 음영+엣지 스파클)·glossy(림+스페큘러)·lava(용암 fbm+flicker)·
 *  cloud(도메인워프 발광)·pulse(코어 글로우+맥동). 무료 = facet. */
export type StarSurface = 'facet' | 'glossy' | 'lava' | 'cloud' | 'pulse'

/** 스킨 축 한 항목의 메타 — 스위처 피커가 소비(id/이름/설명/미리보기 swatch). */
export interface StarSkinMeta<T> {
  id: T
  name: string
  tagline: string
  swatch: string
}

/** 형태 카탈로그 — 노출 순서이자 단일 출처. */
export const STAR_FORMS: StarSkinMeta<StarForm>[] = [
  {
    id: 'lowpoly',
    name: '저폴리',
    tagline: '각진 20면 결정 실루엣',
    swatch: 'conic-gradient(from 30deg at 50% 50%, #2a3a66, #0a0e1e, #3a4a76, #0a0e1e, #2a3a66)',
  },
  {
    id: 'octa',
    name: '8면체',
    tagline: '날카로운 8면 결정',
    swatch: 'linear-gradient(135deg, #5a2a14 0%, #ef7a3a 50%, #5a2a14 100%)',
  },
  {
    id: 'smooth',
    name: '매끈 구',
    tagline: '고밀도 매끈한 코어',
    swatch: 'radial-gradient(circle at 38% 38%, #cdbcff 0%, #5a4fa0 55%, #0a0e1e 100%)',
  },
  {
    id: 'cloudy',
    name: '구름 구',
    tagline: '흩어지는 고분할 빛구름',
    swatch: 'radial-gradient(circle at 50% 50%, #c7b6ff 0%, #8a7be6 45%, #1b1640 100%)',
  },
  {
    id: 'liquid',
    name: '액체 구슬',
    tagline: '출렁이는 변위 구',
    swatch: 'conic-gradient(from 210deg at 50% 50%, #ffb27a, #ff5fa0, #9b7bff, #5fd0c0, #ffb27a)',
  },
]

/** 표면 카탈로그 — 노출 순서이자 단일 출처. */
export const STAR_SURFACES: StarSkinMeta<StarSurface>[] = [
  {
    id: 'facet',
    name: '패싯',
    tagline: '면 음영 · 가장자리 회절 스파클',
    swatch: 'radial-gradient(circle at 62% 40%, #aab6e6 0%, #2a3a66 45%, #050810 100%)',
  },
  {
    id: 'glossy',
    name: '글로시',
    tagline: '림 라이트 · 스페큘러 하이라이트',
    swatch: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #9b7bff 40%, #1b1233 100%)',
  },
  {
    id: 'lava',
    name: '용암',
    tagline: '백열 균열 · 깜빡이는 열',
    swatch: 'radial-gradient(circle at 50% 60%, #ffd27a 0%, #ef5a2a 38%, #2a0a04 100%)',
  },
  {
    id: 'cloud',
    name: '구름빛',
    tagline: '도메인워프 발광 성운',
    swatch: 'radial-gradient(circle at 40% 45%, #d8c8ff 0%, #7f6fd8 45%, #15102e 100%)',
  },
  {
    id: 'pulse',
    name: '맥동',
    tagline: '정면 코어 글로우 · 빠른 맥동',
    swatch:
      'radial-gradient(circle at 50% 50%, #ffffff 0 2px, transparent 3px), radial-gradient(circle at 50% 50%, #cdbcff 0%, #0a0e1e 70%)',
  },
]

export const DEFAULT_STAR_FORM: StarForm = 'lowpoly'
export const DEFAULT_STAR_SURFACE: StarSurface = 'facet'

/** 레거시 단일 StarObject id → (form, surface) 프리셋 디컴포지션(spec 52). crystal·liquid·ember는 시각
 *  보존, aurora·pulsar는 프리셋 폐기하되 그 form/surface 조각은 재조합 가능하게 남긴다. */
export const STAR_PRESETS: Record<StarObject, { form: StarForm; surface: StarSurface }> = {
  deepfield: { form: 'lowpoly', surface: 'facet' },
  liquid: { form: 'liquid', surface: 'glossy' },
  ember: { form: 'octa', surface: 'lava' },
  aurora: { form: 'cloudy', surface: 'cloud' },
  pulsar: { form: 'smooth', surface: 'pulse' },
}

const STAR_FORM_IDS = new Set<string>(STAR_FORMS.map((f) => f.id))
const STAR_SURFACE_IDS = new Set<string>(STAR_SURFACES.map((s) => s.id))

export function parseStarForm(value: unknown, fallback: StarForm = DEFAULT_STAR_FORM): StarForm {
  return typeof value === 'string' && STAR_FORM_IDS.has(value) ? (value as StarForm) : fallback
}
export function parseStarSurface(value: unknown, fallback: StarSurface = DEFAULT_STAR_SURFACE): StarSurface {
  return typeof value === 'string' && STAR_SURFACE_IDS.has(value) ? (value as StarSurface) : fallback
}

/** 별 스킨 선택(2축). */
export interface StarSelection {
  form: StarForm
  surface: StarSurface
}

/** wire 합성 id 인코딩 — "<form>+<surface>". */
export function encodeStarSelection(form: StarForm, surface: StarSurface): string {
  return `${form}+${surface}`
}

/** wire 값 → (form, surface). 합성("a+b")이면 분리(미지 sub-id는 축 기본으로 폴백), 레거시 단일 id면
 *  STAR_PRESETS 디컴포지션, 그 외(미지·빈값)는 기본 프리셋. 크래시 없이 항상 유효 선택을 돌려준다(A9). */
export function decodeStarSelection(wire: unknown): StarSelection {
  if (typeof wire === 'string' && wire.includes('+')) {
    const [f, s] = wire.split('+')
    return { form: parseStarForm(f), surface: parseStarSurface(s) }
  }
  if (typeof wire === 'string' && Object.hasOwn(STAR_PRESETS, wire)) {
    return STAR_PRESETS[wire as StarObject]
  }
  return STAR_PRESETS.deepfield
}

/** wire 값을 유효 합성 id로 정규화(decode→encode round-trip) — store가 선택 영속·서버 머지 경계에서 쓴다. */
export function normalizeStarSelection(wire: unknown): string {
  const { form, surface } = decodeStarSelection(wire)
  return encodeStarSelection(form, surface)
}

/** 기본 합성 선택(무료 lowpoly+facet). */
export const DEFAULT_STAR_SELECTION = encodeStarSelection(DEFAULT_STAR_FORM, DEFAULT_STAR_SURFACE)
