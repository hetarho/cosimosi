import type { SelfObject, SelfObjectMeta } from './types'

/** 고를 수 있는 자아("나") 별 형태(spec 38) — 노출 순서이자 단일 출처. 우주 중심에 단 하나
 *  떠 있는 앵커로, 강한 기억을 곁에 둔다. 일반 별 오브제(StarObject)와 독립된 축. */
export const SELF_OBJECTS: SelfObjectMeta[] = [
  {
    id: 'nebula-heart',
    name: '성운 심장',
    tagline: '형체 없는 빛의 소용돌이 · 안개 응집',
    swatch: 'radial-gradient(circle at 50% 50%, #cdbcff 0%, #7f77dd 40%, #2a2350 72%, #07060f 100%)',
  },
  {
    id: 'core',
    name: '핵',
    tagline: '밝게 타오르는 태양 · 매끈한 발광 구체',
    swatch: 'radial-gradient(circle at 42% 38%, #fff3c4 0%, #ffb24d 38%, #b4521a 72%, #1a0a05 100%)',
  },
  {
    id: 'well',
    name: '중력 우물',
    tagline: '어두운 중심 · 휘어 빨려드는 림 글로우',
    swatch: 'radial-gradient(circle at 50% 50%, #05060c 0%, #0a0e1e 46%, #6b5cff 86%, #b9b2ff 100%)',
  },
]

export const DEFAULT_SELF_OBJECT: SelfObject = 'nebula-heart'
