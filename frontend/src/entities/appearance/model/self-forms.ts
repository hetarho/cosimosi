// 자아("나") 별 스킨의 2축 카탈로그(spec 52) — 형태(form, 지오메트리/실루엣)와 표면(surface, 셰이딩/질감)을
// 독립 선택 축으로 나눈다. 색은 ambient mood 파생(spec 25·07)이고 던지는 빛은 중립(spec 03)이라 form/surface는
// 형태/질감만 바꾼다. 시각 조립은 ui/self-form이 SELF_FORM_BUILDERS×SELF_SURFACE_BUILDERS registry로 한다.
// 선택은 합성 wire id "<form>+<surface>"로 직렬화돼 proto/DB 무변경 — 레거시 단일 id(mirrorball 등)는 폴백.
import type { SelfObject, SelfSkinMeta } from './types'

/** 형태(form) — 지오메트리/실루엣 축. orb(20면 반사구)·cube(박스)·bloom(변위 구). 무료 = orb. */
export type SelfForm = 'orb' | 'cube' | 'bloom'
/** 표면(surface) — 셰이딩/질감 축. mirror(격자 케이지+글린트)·prism(프레임+색분산)·neuron(돌기 셸+핵광).
 *  무료 = mirror. */
export type SelfSurface = 'mirror' | 'prism' | 'neuron'

/** 형태 카탈로그 — 노출 순서이자 단일 출처. */
export const SELF_FORMS: SelfSkinMeta<SelfForm>[] = [
  {
    id: 'orb',
    name: '구체',
    tagline: '여러 면이 빛을 되비추는 반사구',
    swatch: 'conic-gradient(from 35deg at 50% 50%, #cdbcff, #9fb8ef, #cfe6dd, #cdbcff, #7f77dd, #cdbcff)',
  },
  {
    id: 'cube',
    name: '큐브',
    tagline: '구조적 박스 실루엣',
    swatch: 'linear-gradient(135deg, #ff9ec7 0%, #c7b6ff 35%, #7fe0c6 70%, #ffd27a 100%)',
  },
  {
    id: 'bloom',
    name: '돌기 덩어리',
    tagline: 'soma에서 dendrite가 뻗는 유기 변위 구',
    swatch:
      'radial-gradient(circle at 50% 50%, #cdbcff 0%, #7f77dd 30%, transparent 33%), radial-gradient(circle at 20% 30%, #7fe0c6 0 1px, transparent 2px), #1b1640',
  },
]

/** 표면 카탈로그 — 노출 순서이자 단일 출처. */
export const SELF_SURFACES: SelfSkinMeta<SelfSurface>[] = [
  {
    id: 'mirror',
    name: '미러',
    tagline: '격자 케이지 · 정면 반사 글린트',
    swatch: 'conic-gradient(from 35deg at 50% 50%, #cdbcff, #9fb8ef, #cfe6dd, #cdbcff, #7f77dd, #cdbcff)',
  },
  {
    id: 'prism',
    name: '프리즘',
    tagline: '프레임 케이지 · 굴절 색분산',
    swatch: 'linear-gradient(135deg, #ff9ec7 0%, #c7b6ff 35%, #7fe0c6 70%, #ffd27a 100%)',
  },
  {
    id: 'neuron',
    name: '뉴런',
    tagline: '돌기 외피 셸 · 틈새 핵광',
    swatch:
      'radial-gradient(circle at 50% 50%, #cdbcff 0%, #7f77dd 30%, transparent 33%), radial-gradient(circle at 80% 70%, #7fe0c6 0 1px, transparent 2px), #1b1640',
  },
]

export const DEFAULT_SELF_FORM: SelfForm = 'orb'
export const DEFAULT_SELF_SURFACE: SelfSurface = 'mirror'

/** 레거시 단일 SelfObject id → (form, surface) 프리셋 디컴포지션(spec 52) — 시각 보존. */
export const SELF_PRESETS: Record<SelfObject, { form: SelfForm; surface: SelfSurface }> = {
  mirrorball: { form: 'orb', surface: 'mirror' },
  'prism-cube': { form: 'cube', surface: 'prism' },
  'neuron-bloom': { form: 'bloom', surface: 'neuron' },
}

const SELF_FORM_IDS = new Set<string>(SELF_FORMS.map((f) => f.id))
const SELF_SURFACE_IDS = new Set<string>(SELF_SURFACES.map((s) => s.id))

export function parseSelfForm(value: unknown, fallback: SelfForm = DEFAULT_SELF_FORM): SelfForm {
  return typeof value === 'string' && SELF_FORM_IDS.has(value) ? (value as SelfForm) : fallback
}
export function parseSelfSurface(value: unknown, fallback: SelfSurface = DEFAULT_SELF_SURFACE): SelfSurface {
  return typeof value === 'string' && SELF_SURFACE_IDS.has(value) ? (value as SelfSurface) : fallback
}

export interface SelfSelection {
  form: SelfForm
  surface: SelfSurface
}

export function encodeSelfSelection(form: SelfForm, surface: SelfSurface): string {
  return `${form}+${surface}`
}

/** wire 값 → (form, surface). 합성·레거시 단일 id·미지 전부 크래시 없이 유효 선택으로 폴백(A9). */
export function decodeSelfSelection(wire: unknown): SelfSelection {
  if (typeof wire === 'string' && wire.includes('+')) {
    const [f, s] = wire.split('+')
    return { form: parseSelfForm(f), surface: parseSelfSurface(s) }
  }
  if (typeof wire === 'string' && Object.hasOwn(SELF_PRESETS, wire)) {
    return SELF_PRESETS[wire as SelfObject]
  }
  return SELF_PRESETS.mirrorball
}

export function normalizeSelfSelection(wire: unknown): string {
  const { form, surface } = decodeSelfSelection(wire)
  return encodeSelfSelection(form, surface)
}

export const DEFAULT_SELF_SELECTION = encodeSelfSelection(DEFAULT_SELF_FORM, DEFAULT_SELF_SURFACE)
