// 배경(Background) 카탈로그(spec 44 · change 11) — 배경은 *질감/구조*를 고르는 축이고 고정 hue를 소유하지
// 않는다. 모든 배경은 **중립 딥스페이스 팔레트**(NEUTRAL_PALETTE)를 공유하고, 보이는 색은 항상 요즘 mood/
// 감정색에서 파생한다(UniverseNebula의 weaveSlots — R-가중 rankedEmotions + resolveMoodRgb). 스킨이 정하는
// 것은 ① 무늬/질감 결(pattern), ② mood 색을 몇 줄기 짜 넣을지(emotionSlots), ③ 텍스처/요소 슬롯(texture)뿐.
// 별/미인증/로딩처럼 mood가 없으면 중립 팔레트가 그대로 보여 안전한 딥스페이스 fallback이 된다(별 mood 색·
// 사용자 감정색 불오염, A5). swatch는 "색 고르기"가 아니라 중립 질감 token(결이 먼저 구분되게, A4).
// 무료 1종 = vast(values.customization.free.background와 일치), 나머지는 유료.
import { type CosmosPalette } from '@/shared/config'
import type { Background, BackgroundMeta } from './types'

/** 모든 배경이 공유하는 중립 딥스페이스 팔레트(change 11) — 고정 hue 없음. 받침은 어둡고 저채도 cool gray라
 *  요즘 mood 색(weaveSlots)이 위에서 주 hue를 만든다. 감정이 없으면 이 중립색이 그대로 = 안전한 빈 우주 룩. */
const NEUTRAL_PALETTE: CosmosPalette = {
  base: '#05060f',
  c1: '#0d1022',
  c2: '#181d33',
  c3: '#2a3150',
  c4: '#454f6e',
  hi: '#aab2cc',
}
const NEUTRAL_ACCENT = '#8a93ad' // 히어로 엠블럼/self 무-데이터 fallback용 중립 cool gray(고정 hue 아님)
const NEUTRAL_BG = '#05060f' // 우주 캔버스 clear color — 모든 스킨 공통 딥스페이스

/** 고를 수 있는 배경 — 노출 순서이자 단일 출처. 색은 mood 파생(공유 중립 팔레트), 스킨=질감/패턴/슬롯. */
export const BACKGROUNDS: BackgroundMeta[] = [
  {
    id: 'vast',
    effect: 'haze',
    name: '광활한 우주',
    tagline: '가장 조용한 깊이 · 넓은 공간감 · 은은한 한 줄기 감정빛',
    swatch: 'radial-gradient(circle at 50% 38%, #2a3150 0%, #11142a 55%, #05060f 100%)',
    accent: NEUTRAL_ACCENT,
    bg: NEUTRAL_BG,
    palette: NEUTRAL_PALETTE,
    emotionSlots: 1, // 주요 감정 1색만 은은히 — 차분하고 웅장
    pattern: { warp: 0.4, freq: 1.1, detail: 0.4 }, // 크고 고른 결(잔잔한 대성운)
  },
  {
    id: 'lively',
    effect: 'nebula',
    name: '경쾌한 우주',
    tagline: '격동하는 리퀴드 마블 · 감정의 거친 와류와 실선',
    swatch: 'repeating-conic-gradient(from 0deg at 50% 50%, #2a3150 0deg 14deg, #11142a 14deg 28deg)',
    accent: NEUTRAL_ACCENT,
    bg: NEUTRAL_BG,
    palette: NEUTRAL_PALETTE,
    emotionSlots: 3, // 상위 3개 감정을 비중대로 — 생동
    pattern: { warp: 0.85, freq: 1.6, detail: 0.85 }, // 휘몰아치는 거친 결(turbulent)
  },
  {
    id: 'calm',
    effect: 'waves',
    name: '잔잔한 우주',
    tagline: '느린 저주파 파동 · 부드럽고 평온한 추상 그라데이션',
    swatch: 'radial-gradient(ellipse 120% 80% at 50% 50%, #232a45 0%, #0d1022 60%, #05060f 100%)',
    accent: NEUTRAL_ACCENT,
    bg: NEUTRAL_BG,
    palette: NEUTRAL_PALETTE,
    emotionSlots: 1, // 주요 감정 1색만 — 평온
    pattern: { warp: 0.3, freq: 0.85, detail: 0.3 }, // 부드럽고 느슨한 큰 결(soft low-freq)
  },
  {
    id: 'aurora-veil',
    effect: 'aurora',
    name: '오로라 장막',
    tagline: '액체 크로매틱 베일 · 빛의 실크 리본이 감기는 장막',
    swatch: 'repeating-linear-gradient(115deg, #2a3150 0px 3px, #11142a 3px 9px, #05060f 9px 15px)',
    accent: NEUTRAL_ACCENT,
    bg: NEUTRAL_BG,
    palette: NEUTRAL_PALETTE,
    emotionSlots: 4, // 주감정은 최대 4개로 제한
    pattern: { warp: 1.1, freq: 1.9, detail: 0.6 }, // 흐르는 줄무늬 베일(streaky high-warp)
    texture: { veilColor: '#3a4258', veilOpacity: 0.14 }, // 은은한 중립 베일 한 겹(mood 색 불간섭)
  },
  {
    id: 'signal-noise',
    effect: 'static',
    name: '신호와 잡음',
    tagline: '레트로 홀로그램 디더 · 리소그래피 입자와 미세 별빛 매트릭스',
    swatch:
      'radial-gradient(circle at 25% 30%, #3a4163 0 1px, transparent 2px), radial-gradient(circle at 70% 60%, #2a3150 0 1px, transparent 2px), #0a0d1c',
    accent: NEUTRAL_ACCENT,
    bg: NEUTRAL_BG,
    palette: NEUTRAL_PALETTE,
    emotionSlots: 3, // 흩뿌리는 잡음 결에 상위 감정 다색을 흩어 넣음
    pattern: { warp: 0.5, freq: 2.4, detail: 1.0 }, // 촘촘하고 거친 미세 잡음(high freq·detail)
  },
  {
    id: 'abyssal-sea',
    effect: 'caustics',
    name: '심해',
    tagline: '심해 프리즘 caustics · 무지개빛 굴절 광학 예술',
    swatch: 'radial-gradient(ellipse 140% 100% at 50% 120%, #1a2438 0%, #0a1020 55%, #05060f 100%)',
    accent: NEUTRAL_ACCENT,
    bg: NEUTRAL_BG,
    palette: NEUTRAL_PALETTE,
    emotionSlots: 1, // 깊은 물빛 한 줄기로 주요 감정만
    pattern: { warp: 0.35, freq: 0.7, detail: 0.25 }, // 느리고 큰 심해 파동(very low freq)
    texture: { veilColor: '#163048', veilOpacity: 0.18 }, // 물빛 굴절 느낌의 중립 베일
  },
  {
    id: 'cosmic-cliffs',
    effect: 'ridges',
    name: '성운 절벽',
    tagline: '추상 등고선 능선 · 먼지 절벽이 빚어낸 지형도',
    swatch:
      'repeating-linear-gradient(80deg, #2a3150 0px 4px, #161b30 4px 11px, #0a0d1c 11px 18px)',
    accent: NEUTRAL_ACCENT,
    bg: NEUTRAL_BG,
    palette: NEUTRAL_PALETTE,
    emotionSlots: 3, // 능선마다 상위 감정 다색이 빛남
    pattern: { warp: 0.9, freq: 1.3, detail: 0.8 }, // 깎인 능선/기둥 구조(ridged structure)
  },
]

export const DEFAULT_BACKGROUND: Background = 'vast'

const fallbackBackground = BACKGROUNDS[0]

/** 배경 메타 조회(알 수 없는 id면 기본 vast로 폴백, A13). */
export const backgroundMeta = (id: Background): BackgroundMeta =>
  BACKGROUNDS.find((b) => b.id === id) ?? fallbackBackground

/** 배경 → accent hex(히어로 엠블럼 등). */
export const themeAccent = (bg: Background): string => backgroundMeta(bg).accent

/** 배경 → fluid(오로라) 팔레트 — 비-우주 배경(CosmosScene)이 소비. 단일 출처(옛 paletteForTheme 대체). */
export const paletteForBackground = (bg: Background): CosmosPalette => backgroundMeta(bg).palette
