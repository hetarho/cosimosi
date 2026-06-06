// 랜딩 전용 전체-페이지 테마. 식별자를 루트 래퍼의 data-landing-theme로 박으면
// index.css의 [data-landing-theme="…"] 토큰 블록이 글래스·히어로·액센트 크롬을 재테마하고,
// LandingBackground가 식별자로 배경 atmosphere 컴포넌트를 고른다. 시각화(별·시냅스)는
// 모두 '빛'으로 그려지고(VizStar/VizSynapse), 테마는 팔레트·배경·재질로 차별화된다.
// 페이지 로컬(웹 전용) 상태라 localStorage 지속을 허용한다.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LandingThemeId = 'deepfield' | 'aurora' | 'liquid' | 'ember'

export interface LandingThemeMeta {
  id: LandingThemeId
  /** 스위처에 보이는 이름. */
  name: string
  /** 한 줄 설명. */
  tagline: string
  /** 스위처 칩 미리보기 그라디언트(CSS background 값). */
  swatch: string
}

/** 스위처에 노출되는 순서이자 단일 출처. */
export const THEMES: LandingThemeMeta[] = [
  {
    id: 'deepfield',
    name: 'Deep Field',
    tagline: '천체사진의 깊이 · 고운 그레인',
    swatch: 'radial-gradient(circle at 62% 40%, #2a3a66 0%, #0a0e1e 55%, #030308 100%)',
  },
  {
    id: 'aurora',
    name: 'Noir Aurora',
    tagline: '흐르는 그레이니 오로라',
    swatch: 'linear-gradient(135deg, #c7b6ff 0%, #8a7be6 35%, #ff9ec7 68%, #7fe0c6 100%)',
  },
  {
    id: 'liquid',
    name: 'Liquid Light',
    tagline: '액체처럼 흐르는 빛',
    swatch: 'conic-gradient(from 210deg at 50% 50%, #ffb27a, #ff5fa0, #9b7bff, #5fd0c0, #ffb27a)',
  },
  {
    id: 'ember',
    name: 'Ink & Ember',
    tagline: '먹빛 위 단 하나의 잉걸',
    swatch: 'radial-gradient(circle at 38% 38%, #ef7a3a 0%, #5a2a14 45%, #0a0707 100%)',
  },
]

export const DEFAULT_THEME: LandingThemeId = 'deepfield'

const THEME_IDS = new Set(THEMES.map((t) => t.id))

interface LandingThemeState {
  theme: LandingThemeId
  setTheme: (id: LandingThemeId) => void
}

/** localStorage 지속(키: cosimosi.landing.theme). 새로고침해도 마지막 테마 유지. */
export const useLandingTheme = create<LandingThemeState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      setTheme: (id) => set({ theme: id }),
    }),
    {
      name: 'cosimosi.landing.theme',
      // 알 수 없는/구버전 값이 저장돼 있어도 기본 테마로 폴백.
      merge: (persisted, current) => {
        const p = persisted as Partial<LandingThemeState> | undefined
        const theme = p?.theme && THEME_IDS.has(p.theme) ? p.theme : current.theme
        return { ...current, theme }
      },
    },
  ),
)
