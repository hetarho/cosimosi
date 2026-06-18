// 시냅스 스타일 카탈로그(spec 44, 시냅스 축) — 연결선의 *스타일(표현)*을 커스터마이즈 아이템으로 판다.
// 색은 여전히 양끝 별 mood 블렌드(불변)이고 weight→밝기/alpha/펄스 시각·삭제금지 불변식도 유지된다 —
// 스타일은 선의 *표현*(가닥/빔/흐름/입자)만 바꾼다. 무료 = filament(현재 렌더). id = kind("synapse:<id>").
export type SynapseStyle = 'filament' | 'beam' | 'flow' | 'particle'

export interface SynapseStyleMeta {
  id: SynapseStyle
  /** 스위처에 보이는 이름. */
  name: string
  /** 한 줄 설명. */
  tagline: string
  /** 스위처 칩 미리보기 그라디언트(CSS background 값). */
  swatch: string
}

/** 고를 수 있는 시냅스 스타일 — 노출 순서이자 단일 출처. 무료 filament + 유료 beam/flow/particle. */
export const SYNAPSE_STYLES: SynapseStyleMeta[] = [
  {
    id: 'filament',
    name: '가닥',
    tagline: '여러 빛가닥이 꼬여 흐르는 기본 연결',
    swatch: 'linear-gradient(90deg, #7f77dd 0%, #cdbcff 50%, #7fe0c6 100%)',
  },
  {
    id: 'beam',
    name: '빔',
    tagline: '단단한 코어 한 줄기 · 곧고 또렷',
    swatch: 'linear-gradient(90deg, rgba(127,119,221,0.15) 0%, #cdbcff 50%, rgba(127,224,198,0.15) 100%)',
  },
  {
    id: 'flow',
    name: '흐름',
    tagline: '빛이 한 방향으로 흘러가는 물결',
    swatch: 'linear-gradient(110deg, #2a2350 0%, #7f77dd 35%, #cdbcff 55%, #2a2350 100%)',
  },
  {
    id: 'particle',
    name: '입자',
    tagline: '점점이 떠가는 빛 알갱이',
    swatch:
      'radial-gradient(circle at 20% 50%, #cdbcff 0 2px, transparent 3px), radial-gradient(circle at 50% 50%, #cdbcff 0 2px, transparent 3px), radial-gradient(circle at 80% 50%, #7fe0c6 0 2px, transparent 3px), #1b1640',
  },
]

export const DEFAULT_SYNAPSE_STYLE: SynapseStyle = 'filament'
