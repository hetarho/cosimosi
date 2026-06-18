// 코스모스 배경 팔레트 — fluid "오로라" 머티리얼이 쓰는 6-슬롯 색표의 *순수 shape*(데이터만, three 없음).
// 단일 출처를 여기(shared/config)에 둬서 shared/ui(머티리얼)와 entities/appearance(배경 카탈로그)가 같은
// 타입을 FSD 위반 없이 공유한다 — entity가 three에 의존하는 shared/ui를 import하지 않게(헌법4).

/** 6-슬롯 fluid 팔레트: 깊은 base → 4 중간 톤(c1..c4) → 밝은 하이라이트(hi). 배경별로 갈아끼운다. */
export interface CosmosPalette {
  base: string
  c1: string
  c2: string
  c3: string
  c4: string
  hi: string
}

/** 기본(배경 vast) 팔레트 — 깊은 violet base, 소프트 magenta/pink/violet/lavender, 따뜻한 cream 하이라이트. */
export const DEFAULT_PALETTE: CosmosPalette = {
  base: '#0b0b1c',
  c1: '#3a2b6b',
  c2: '#8d5bd6',
  c3: '#d479c6',
  c4: '#b9a7ef',
  hi: '#f3e6d0',
}
