// 배경(Background) 카탈로그(spec 44) — 옛 themes.ts의 정명. 각 배경은 색만이 아니라 fluid 팔레트 + 텍스처
// 슬롯을 포함한 backdrop *번들*이다(A9). 무료 1종 = vast(values.customization.free.background와 일치),
// 유료 = lively·calm·aurora-veil. 배경별 fluid 팔레트의 단일 출처가 여기로 이전됐다(옛 shared/ui THEME_PALETTES).
import { type CosmosPalette, DEFAULT_PALETTE } from '@/shared/config'
import type { Background, BackgroundMeta } from './types'

/** 고를 수 있는 배경 — 노출 순서이자 단일 출처. accent/bg/palette는 코스모스 색 시스템과 짝을 맞춘다. */
export const BACKGROUNDS: BackgroundMeta[] = [
  {
    id: 'vast',
    name: '광활한 우주',
    tagline: '깊은 인디고 심연 · 차분하고 웅장',
    swatch: 'radial-gradient(circle at 50% 38%, #6b5cff 0%, #1b1640 52%, #07060f 100%)',
    accent: '#7f77dd', // MOOD.violet
    bg: '#070b1e', // 깊은 인디고
    palette: DEFAULT_PALETTE, // vast = 기본 violet 팔레트
  },
  {
    id: 'lively',
    name: '경쾌한 우주',
    tagline: '따뜻한 자홍 · 채도 높고 생동',
    // 색 무드(채움) — 형태를 나타내는 오브제 conic swatch와 헷갈리지 않게 linear로.
    swatch: 'linear-gradient(135deg, #ffc27a 0%, #ff6fae 50%, #c77bff 100%)',
    accent: '#ef9f27', // MOOD.amber
    bg: '#120617', // 깊은 자홍
    palette: { base: '#120617', c1: '#4a1f3a', c2: '#c75ba0', c3: '#ff7a8f', c4: '#ffb27a', hi: '#ffe6c8' },
  },
  {
    id: 'calm',
    name: '잔잔한 우주',
    tagline: '고요한 청록 · 부드럽고 평온',
    swatch: 'radial-gradient(circle at 50% 40%, #3fd6b5 0%, #114a44 58%, #06120f 100%)',
    accent: '#1d9e75', // MOOD.teal
    bg: '#04140f', // 깊은 청록
    palette: { base: '#04140f', c1: '#0e3b38', c2: '#1d9e75', c3: '#3fd6b5', c4: '#9fe6cf', hi: '#e6f3ea' },
  },
  {
    id: 'aurora-veil',
    name: '오로라 장막',
    tagline: '극광이 흐르는 베일 · 청보라 결',
    swatch: 'linear-gradient(150deg, #0a1830 0%, #2f7fb0 38%, #6fe0c0 64%, #b9a7ef 100%)',
    accent: '#5fd0c0',
    bg: '#04101c', // 깊은 청록빛 남색
    palette: { base: '#04101c', c1: '#143a52', c2: '#2f8fb0', c3: '#5fd0c0', c4: '#9fb8ef', hi: '#e8f6f0' },
    // 텍스처/요소 슬롯(번들) — 은은한 극광 베일 한 겹(별 mood 색 불간섭). 비주얼은 디자인 반복.
    texture: { veilColor: '#1f5f7a', veilOpacity: 0.16 },
  },
]

export const DEFAULT_BACKGROUND: Background = 'vast'

const fallbackBackground = BACKGROUNDS[0]

/** 배경 메타 조회(알 수 없는 id면 기본 vast로 폴백, A13). */
export const backgroundMeta = (id: Background): BackgroundMeta =>
  BACKGROUNDS.find((b) => b.id === id) ?? fallbackBackground

/** 배경 → accent hex(히어로 엠블럼 등). */
export const themeAccent = (bg: Background): string => backgroundMeta(bg).accent

/** 배경 → 우주(universe) 캔버스 배경색(THREE clear color). */
export const themeBg = (bg: Background): string => backgroundMeta(bg).bg

/** 배경 → fluid(오로라) 팔레트 — 비-우주 배경(CosmosScene)이 소비. 단일 출처(옛 paletteForTheme 대체). */
export const paletteForBackground = (bg: Background): CosmosPalette => backgroundMeta(bg).palette

// ── 정명 전 호환 alias(옛 themes.ts API) — 점진 정리용. ──────────────────────────────────────
/** @deprecated 정명은 BACKGROUNDS. */
export const THEMES = BACKGROUNDS
/** @deprecated 정명은 DEFAULT_BACKGROUND. */
export const DEFAULT_THEME = DEFAULT_BACKGROUND
