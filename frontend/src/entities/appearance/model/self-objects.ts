import type { SelfObject, SelfObjectMeta } from './types'

/** 고를 수 있는 자아("나") 별 형태(spec 38 · change 11) — 노출 순서이자 단일 출처. 우주 중심(또는 recall
 *  어깨앵커, spec 49)에 단 하나 떠 강한 기억을 곁에 둔다. 일반 별 오브제(StarObject)와 독립된 축.
 *  무료 mirrorball + 유료 prism-cube·neuron-bloom. 레거시 nebula-heart·core·well은 카탈로그에서 제거됐고
 *  로드/렌더/저장 경계에서 mirrorball로 정규화된다(데이터 삭제 없음). */
export const SELF_OBJECTS: SelfObjectMeta[] = [
  {
    id: 'mirrorball',
    name: '미러볼',
    tagline: '여러 면이 주변 기억의 빛을 되비추는 반사구',
    swatch:
      'conic-gradient(from 35deg at 50% 50%, #cdbcff, #9fb8ef, #cfe6dd, #cdbcff, #7f77dd, #cdbcff)',
  },
  {
    id: 'prism-cube',
    name: '프리즘 큐브',
    tagline: '굴절·색분산·내부 반사가 있는 구조적 자아',
    swatch:
      'linear-gradient(135deg, #ff9ec7 0%, #c7b6ff 35%, #7fe0c6 70%, #ffd27a 100%)',
  },
  {
    id: 'neuron-bloom',
    name: '뉴런 꽃',
    tagline: 'soma에서 dendrite가 뻗는 형태 · 기억·시냅스 세계관을 그대로',
    swatch:
      'radial-gradient(circle at 50% 50%, #cdbcff 0%, #7f77dd 30%, transparent 33%), radial-gradient(circle at 20% 30%, #7fe0c6 0 1px, transparent 2px), radial-gradient(circle at 80% 70%, #cdbcff 0 1px, transparent 2px), #1b1640',
  },
]

export const DEFAULT_SELF_OBJECT: SelfObject = 'mirrorball'
