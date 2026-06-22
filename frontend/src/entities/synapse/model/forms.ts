// 시냅스 스킨의 2축 카탈로그(spec 52) — 형태(form, 선 구조/지오메트리)와 표면(surface, 움직임/질감)을 독립
// 선택 축으로 나눈다. 색은 항상 양끝 별 mood 블렌드(불변), weight→밝기/alpha/펄스 시각·삭제금지 바닥 불투명·
// Line2(헌법8) 불변식도 유지된다 — form/surface는 선의 *구조*와 *표현*만 바꾼다. 시각 조립은
// ui/SynapseFilaments가 한다(form=지오메트리 다발, surface=셰이더 흐름). 선택은 합성 wire id "<form>+<surface>"로
// 직렬화돼 proto/DB 무변경 — 레거시 단일 id(filament 등)는 디컴포지션 폴백.
import type { SynapseStyle } from './styles'

/** 형태(form) — 선 구조 축. strands(꼬인 가닥 다발)·branched(돌기 가지 다발)·dotted(가는 한 줄). 무료 = strands. */
export type SynapseForm = 'strands' | 'branched' | 'dotted'
/** 표면(surface) — 움직임/질감 축. flow(빛 패킷 흐름)·beads(점점이 흐르는 비드)·steady(잔잔한 정상 발광).
 *  무료 = flow. */
export type SynapseSurface = 'flow' | 'beads' | 'steady'

export interface SynapseSkinMeta<T> {
  id: T
  name: string
  tagline: string
  swatch: string
}

/** 형태 카탈로그 — 노출 순서이자 단일 출처. */
export const SYNAPSE_FORMS: SynapseSkinMeta<SynapseForm>[] = [
  {
    id: 'strands',
    name: '가닥',
    tagline: '여러 빛가닥이 꼬여 흐르는 다발',
    swatch: 'linear-gradient(90deg, #7f77dd 0%, #cdbcff 50%, #7fe0c6 100%)',
  },
  {
    id: 'branched',
    name: '돌기',
    tagline: '작은 가지가 갈라지는 신경 돌기 다발',
    swatch:
      'linear-gradient(90deg, #7f77dd 0%, #cdbcff 100%), radial-gradient(circle at 35% 30%, #cdbcff 0 1px, transparent 2px), radial-gradient(circle at 65% 70%, #7fe0c6 0 1px, transparent 2px)',
  },
  {
    id: 'dotted',
    name: '가는 줄',
    tagline: '한 줄로 또렷한 가는 연결',
    swatch: 'linear-gradient(90deg, transparent 0%, #cdbcff 50%, transparent 100%)',
  },
]

/** 표면 카탈로그 — 노출 순서이자 단일 출처. */
export const SYNAPSE_SURFACES: SynapseSkinMeta<SynapseSurface>[] = [
  {
    id: 'flow',
    name: '흐름',
    tagline: 'A→B로 흐르는 빛 패킷',
    swatch: 'linear-gradient(90deg, #1b1640 0%, #cdbcff 45%, #7fe0c6 55%, #1b1640 100%)',
  },
  {
    id: 'beads',
    name: '비드',
    tagline: '점점이 떠가는 빛 알갱이',
    swatch:
      'radial-gradient(circle at 20% 50%, #cdbcff 0 2px, transparent 3px), radial-gradient(circle at 50% 50%, #cdbcff 0 2px, transparent 3px), radial-gradient(circle at 80% 50%, #7fe0c6 0 2px, transparent 3px), #1b1640',
  },
  {
    id: 'steady',
    name: '잔잔',
    tagline: '흐름 없이 은은히 빛나는 가닥',
    swatch: 'linear-gradient(90deg, #7f77dd 0%, #cdbcff 50%, #7fe0c6 100%)',
  },
]

export const DEFAULT_SYNAPSE_FORM: SynapseForm = 'strands'
export const DEFAULT_SYNAPSE_SURFACE: SynapseSurface = 'flow'

/** 레거시 단일 SynapseStyle id → (form, surface) 프리셋 디컴포지션(spec 52). filament는 시각 보존, particle·
 *  dendrite도 보존되게 매핑한다. */
export const SYNAPSE_PRESETS: Record<SynapseStyle, { form: SynapseForm; surface: SynapseSurface }> = {
  filament: { form: 'strands', surface: 'flow' },
  particle: { form: 'dotted', surface: 'beads' },
  dendrite: { form: 'branched', surface: 'flow' },
}

const SYNAPSE_FORM_IDS = new Set<string>(SYNAPSE_FORMS.map((f) => f.id))
const SYNAPSE_SURFACE_IDS = new Set<string>(SYNAPSE_SURFACES.map((s) => s.id))

export function parseSynapseForm(value: unknown, fallback: SynapseForm = DEFAULT_SYNAPSE_FORM): SynapseForm {
  return typeof value === 'string' && SYNAPSE_FORM_IDS.has(value) ? (value as SynapseForm) : fallback
}
export function parseSynapseSurface(
  value: unknown,
  fallback: SynapseSurface = DEFAULT_SYNAPSE_SURFACE,
): SynapseSurface {
  return typeof value === 'string' && SYNAPSE_SURFACE_IDS.has(value) ? (value as SynapseSurface) : fallback
}

export interface SynapseSelection {
  form: SynapseForm
  surface: SynapseSurface
}

export function encodeSynapseSelection(form: SynapseForm, surface: SynapseSurface): string {
  return `${form}+${surface}`
}

/** wire 값 → (form, surface). 합성·레거시 단일 id·미지 전부 크래시 없이 유효 선택으로 폴백(A9). */
export function decodeSynapseSelection(wire: unknown): SynapseSelection {
  if (typeof wire === 'string' && wire.includes('+')) {
    const [f, s] = wire.split('+')
    return { form: parseSynapseForm(f), surface: parseSynapseSurface(s) }
  }
  if (typeof wire === 'string' && Object.hasOwn(SYNAPSE_PRESETS, wire)) {
    return SYNAPSE_PRESETS[wire as SynapseStyle]
  }
  return SYNAPSE_PRESETS.filament
}

export function normalizeSynapseSelection(wire: unknown): string {
  const { form, surface } = decodeSynapseSelection(wire)
  return encodeSynapseSelection(form, surface)
}

export const DEFAULT_SYNAPSE_SELECTION = encodeSynapseSelection(DEFAULT_SYNAPSE_FORM, DEFAULT_SYNAPSE_SURFACE)
