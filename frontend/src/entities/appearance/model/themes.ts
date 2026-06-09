import type { Theme, ThemeMeta } from './types'

/** 색 테마 — 스위처 노출 순서이자 단일 출처. accent/bg는 코스모스 색 시스템과 짝을 맞춘다. */
export const THEMES: ThemeMeta[] = [
  {
    id: 'vast',
    name: '광활한 우주',
    tagline: '깊은 인디고 심연 · 차분하고 웅장',
    swatch: 'radial-gradient(circle at 50% 38%, #6b5cff 0%, #1b1640 52%, #07060f 100%)',
    accent: '#7f77dd', // MOOD.violet
    bg: '#070b1e', // 깊은 인디고
  },
  {
    id: 'lively',
    name: '경쾌한 우주',
    tagline: '따뜻한 자홍 · 채도 높고 생동',
    // 색 무드(채움) — 형태를 나타내는 오브제 conic swatch와 헷갈리지 않게 linear로.
    swatch: 'linear-gradient(135deg, #ffc27a 0%, #ff6fae 50%, #c77bff 100%)',
    accent: '#ef9f27', // MOOD.amber
    bg: '#120617', // 깊은 자홍
  },
  {
    id: 'calm',
    name: '잔잔한 우주',
    tagline: '고요한 청록 · 부드럽고 평온',
    swatch: 'radial-gradient(circle at 50% 40%, #3fd6b5 0%, #114a44 58%, #06120f 100%)',
    accent: '#1d9e75', // MOOD.teal
    bg: '#04140f', // 깊은 청록
  },
]

export const DEFAULT_THEME: Theme = 'vast'

const fallbackTheme = THEMES[0]

/** 테마 → 테마색을 따르는 오브제의 mood hex accent(히어로 엠블럼 등). */
export const themeAccent = (theme: Theme): string =>
  (THEMES.find((t) => t.id === theme) ?? fallbackTheme).accent

/** 테마 → 우주(universe) 캔버스 배경색(THREE). */
export const themeBg = (theme: Theme): string =>
  (THEMES.find((t) => t.id === theme) ?? fallbackTheme).bg
