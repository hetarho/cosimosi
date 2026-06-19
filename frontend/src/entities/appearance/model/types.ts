// 앱의 시각 설정(appearance) — 유저가 *고른* 선호. 4축(서로 독립, spec 44):
//   Background — 우주의 배경(색 + 팔레트 + 텍스처/요소 *번들*). 옛 "테마(theme)"의 정명.
//   (별 오브제 형태는 star entity의 StarObject, 시냅스 스타일은 synapse entity의 SynapseStyle —
//    appearance.store가 그 타입을 참조해 '선택'만 든다.)
//   Self — 중심 "나" 별의 형태(spec 38).
// 색(mood)은 축과 무관하게 보존된다(감정 의미색). 배경 변경은 별의 mood 색을 바꾸지 않는다(A9).
import type { CosmosPalette } from '@/shared/config'

/** 배경(Background) kind — 옛 Theme의 정명. 무료 vast + 유료(lively·calm·aurora-veil). */
export type Background = 'vast' | 'lively' | 'calm' | 'aurora-veil'

/** 배경의 텍스처/요소 슬롯(번들) — 색 외의 배경 결. 비주얼 디테일은 디자인 반복(slot minimal).
 *  veilColor/veilOpacity = 장면 뒤에 깔리는 은은한 색 베일(별 mood 색은 불간섭 — 별 앞이 아닌 배경 결). */
export interface BackgroundTexture {
  veilColor?: string
  veilOpacity?: number
}

/** 배경 스킨의 무늬/질감 결(spec 07) — 색만이 아니라 *패턴 자체*가 스킨마다 다르게(같은 fbm·색만
 *  다른 상태가 아니다, A6). UniverseNebula의 도메인워프 fbm 파라미터를 스킨별로 조율한다. */
export interface BackgroundPattern {
  /** 도메인워프 세기 — 클수록 무늬가 휘몰아치는 결(작으면 잔잔·고른 결). */
  warp: number
  /** 기본 노이즈 주파수 — 클수록 촘촘한 미세 결, 작으면 크고 느슨한 덩어리. */
  freq: number
  /** 미세 디테일 게인 — 2차 fbm이 밴드를 깨는 정도(질감의 거칠기). */
  detail: number
}

/** 배경 아이템 메타 — 색만이 아니라 팔레트·무늬·감정색 슬롯을 포함한 backdrop 번들(spec 07·44 A9). */
export interface BackgroundMeta {
  id: Background
  /** 스위처에 보이는 이름. */
  name: string
  /** 한 줄 설명. */
  tagline: string
  /** 스위처 칩 미리보기 그라디언트(CSS background 값). */
  swatch: string
  /** 배경색을 따르는 오브제(히어로 엠블럼 등)의 hex accent. */
  accent: string
  /** 우주(universe) 캔버스의 깊은 배경색(THREE clear color). */
  bg: string
  /** fluid(오로라) 배경 팔레트 — 비-우주 배경(CosmosScene) 색. 받침색(base/c1)은 절제된 톤. 배경별 단일 출처. */
  palette: CosmosPalette
  /** 이 스킨이 짜 넣는 상위 감정색 수(spec 07). 0=감정 무관 순수 텍스처 · 1=주요 감정 1색 · N=비중대로 다색.
   *  시각 정의(코드 카탈로그)라 values.yaml이 아니라 여기 둔다(A11). */
  emotionSlots: number
  /** 무늬/질감 결 — 스킨마다 다른 패턴(A6). */
  pattern: BackgroundPattern
  /** 색 외의 텍스처/요소 번들(없으면 최소 배경 — vast). */
  texture?: BackgroundTexture
}

/** @deprecated 정명은 Background. proto/DB/store 와이어 id는 `theme`을 유지하므로 alias로 남긴다. */
export type Theme = Background
/** @deprecated 정명은 BackgroundMeta. */
export type ThemeMeta = BackgroundMeta

/** 중심 "나" 별(self anchor)의 형태(spec 38·44). 우주에 단 하나, 중심에 고정되어 강한 기억을 곁에 둔다. */
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
