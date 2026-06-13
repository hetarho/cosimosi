// 앱의 시각 설정(appearance) — 유저가 *고른* 선호. 두 축(서로 독립):
//   Theme      — 우주의 색·분위기(vast/lively/calm). 배경·표면·accent 코스모스 색 시스템을 운반.
//   (별 오브제의 형태는 star entity의 StarObject — appearance.store가 그 타입을 참조해 '선택'만 든다.)
// 색(mood)은 두 축과 무관하게 보존된다(감정 의미색).

/** 우주의 색·분위기 테마. */
export type Theme = 'vast' | 'lively' | 'calm'

/** 중심 "나" 별(self anchor)의 형태(spec 38). 일반 별 오브제(StarObject)와 별개 축 —
 *  우주에 단 하나, 중심에 고정되어 강한 기억을 곁에 둔다. */
export type SelfObject = 'nebula-heart' | 'core' | 'well'

export interface SelfObjectMeta {
  id: SelfObject
  /** 스위처에 보이는 이름. */
  name: string
  /** 한 줄 설명. */
  tagline: string
  /** 스위처 칩 미리보기 그라디언트(CSS background 값). */
  swatch: string
}

export interface ThemeMeta {
  id: Theme
  /** 스위처에 보이는 이름. */
  name: string
  /** 한 줄 설명. */
  tagline: string
  /** 스위처 칩 미리보기 그라디언트(CSS background 값). */
  swatch: string
  /** 테마색을 따르는 오브제(히어로 엠블럼 등)의 mood hex accent. */
  accent: string
  /** 우주(universe) 캔버스의 깊은 배경색(THREE). */
  bg: string
}
