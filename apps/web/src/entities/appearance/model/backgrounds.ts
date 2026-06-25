// 배경(Background) 카탈로그(spec 44·51 · change 11) — 배경은 *질감/구조*를 고르는 축이고 고정 hue를 소유하지
// 않는다. 모든 배경은 **중립 딥스페이스 팔레트**(NEUTRAL_PALETTE)를 공유하고, 보이는 색은 항상 요즘 mood/
// 감정색에서 파생한다. 시각 조립은 `entities/appearance/ui/background-form`이 shared 셰이더 아트 툴킷(plan 50)을
// 조합해 만들고, `UniverseNebula` 셸은 N-제네릭으로 그리기만 한다(plan 51). 스킨이 정하는 것은 ① 무늬 결(pattern),
// ② mood 색을 몇 줄기 짤지(emotionSlots), ③ 효과별 튜닝 수치(params)뿐. mood가 없으면 중립 받침이 그대로 보여
// 안전한 딥스페이스 fallback이 된다(별 mood 색·사용자 감정색 불오염). 무료 1종 = galaxy(values.customization.free.background와 일치).
import { type CosmosPalette } from '@/shared/config'
import type { Background, BackgroundMeta } from './types'

/** 모든 배경이 공유하는 중립 딥스페이스 팔레트(change 11) — 고정 hue 없음. 받침은 어둡고 저채도 cool gray라
 *  요즘 mood 색이 위에서 주 hue를 만든다. 감정이 없으면 이 중립색이 그대로 = 안전한 빈 우주 룩. */
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

/** 고를 수 있는 배경 — 노출 순서이자 단일 출처. 색은 mood 파생(공유 중립 팔레트), 스킨=효과·결·params·슬롯.
 *  effect = background-form registry key(kind와 1:1). swatch는 색 고르기가 아니라 결을 암시하는 중립 token. */
export const BACKGROUNDS: BackgroundMeta[] = [
  {
    id: 'galaxy',
    effect: 'galaxy',
    name: '나선 은하',
    tagline: '적도 은하면에 감겨 흐르는 나선팔 · 먼지빛 사이로 떠오르는 감정',
    swatch:
      'radial-gradient(circle at 50% 50%, #2a3150 0%, #11142a 42%, #05060f 100%), conic-gradient(from 210deg at 50% 50%, #2a3150, #0a0d1c, #232a45, #0a0d1c, #2a3150)',
    accent: NEUTRAL_ACCENT,
    bg: NEUTRAL_BG,
    palette: NEUTRAL_PALETTE,
    emotionSlots: 3, // 나선팔 따라 상위 감정 다색
    pattern: { warp: 0.5, freq: 1.0, detail: 0.5 }, // freq=먼지 결 크기
    params: {
      arms: 5, //        나선팔 개수(은하 줄무늬 수)
      twist: 0.8, //     팔이 감기는 정도(log-spiral 계수) — ↑일수록 촘촘히 감김
      spinSpeed: 0.04, // 회전 속도(arousal·reduced-motion과 곱) — ↑이면 빨리 돈다
      bandSharp: 2.2, //  은하면 두께 — ↑일수록 적도에 얇게 집중, ↓이면 하늘 전체로 퍼짐
      coreGlow: 0.5, //   은하면 중심 글로우 세기
      armBright: 0.55, // 나선팔 밝기
    },
  },
  {
    id: 'vortex',
    effect: 'vortex',
    name: '블랙홀 와류',
    tagline: '어두운 중심으로 빨려드는 강착원반 · 휘감기는 빛의 소용돌이',
    swatch:
      'radial-gradient(circle at 50% 50%, #05060f 0%, #05060f 16%, #3a4163 34%, #2a3150 52%, #0a0d1c 100%)',
    accent: NEUTRAL_ACCENT,
    bg: NEUTRAL_BG,
    palette: NEUTRAL_PALETTE,
    emotionSlots: 3, // 원반 와류에 상위 감정 다색
    pattern: { warp: 0.9, freq: 1.4, detail: 0.7 }, // warp=원반 휘감김, freq=결 밀도
    params: {
      coreFocus: 2.0, // 중심 집중도 — ↑일수록 원반이 극에 가깝게 좁아진다
      ringGain: 0.65, // 강착원반 밝기
    },
  },
  {
    id: 'crystal',
    effect: 'crystal',
    name: '결정 세포',
    tagline: '빛나는 경계선으로 짜인 결정·세포망 · 면마다 다른 감정의 결',
    swatch:
      'conic-gradient(from 0deg at 50% 50%, #2a3150 0deg 60deg, #11142a 60deg 120deg, #2a3150 120deg 180deg, #11142a 180deg 240deg, #2a3150 240deg 300deg, #11142a 300deg 360deg)',
    accent: NEUTRAL_ACCENT,
    bg: NEUTRAL_BG,
    palette: NEUTRAL_PALETTE,
    emotionSlots: 3, // 셀마다 상위 감정 다색
    pattern: { warp: 0.3, freq: 0.6, detail: 0.4 }, // freq=셀 크기 미세 조정(+cellScale)
    params: {
      cellScale: 3.2, // 셀 크기(↑일수록 셀이 작고 촘촘)
      jitter: 1.0, //   셀 중심 불규칙도(0=격자, 1=유기적)
      edgeSharp: 8, //  경계선 가늘기 — ↑일수록 가는 선
      edgeGlow: 0.6, // 경계선 밝기
      cellTone: 0.12, // 셀 내부 미세 명암 세기
    },
  },
  {
    id: 'mandala',
    effect: 'mandala',
    name: '만다라',
    tagline: '방사 대칭으로 접힌 신성기하 · 겹겹이 층진 감정의 무늬',
    swatch:
      'repeating-radial-gradient(circle at 50% 50%, #2a3150 0 3px, #11142a 3px 8px, #05060f 8px 14px)',
    accent: NEUTRAL_ACCENT,
    bg: NEUTRAL_BG,
    palette: NEUTRAL_PALETTE,
    emotionSlots: 4, // 층마다 상위 감정 다색(최대 4)
    pattern: { warp: 0.5, freq: 0.8, detail: 0.5 }, // freq=무늬 밀도
    params: {
      segments: 8, //   거울 대칭 분할 수(꽃잎 대칭 차수)
      petals: 6, //     꽃잎/방사 줄무늬 수
      ringFreq: 3, //   동심 층(위도 방향) 밀도
      steps: 6, //      등고선 계단 층 수
      maskGain: 0.55, // 무늬 전체 밝기
    },
  },
]

export const DEFAULT_BACKGROUND: Background = 'galaxy'

const fallbackBackground = BACKGROUNDS[0]
const BACKGROUND_IDS = new Set<string>(BACKGROUNDS.map((b) => b.id))

export function isBackground(value: unknown): value is Background {
  return typeof value === 'string' && BACKGROUND_IDS.has(value)
}

export function parseBackground(value: unknown, fallback: Background = DEFAULT_BACKGROUND): Background {
  return isBackground(value) ? value : fallback
}

/** 배경 메타 조회(알 수 없는 id면 기본 galaxy로 폴백). */
export const backgroundMeta = (id: Background): BackgroundMeta =>
  BACKGROUNDS.find((b) => b.id === id) ?? fallbackBackground

/** 배경 → accent hex(히어로 엠블럼 등). */
export const themeAccent = (bg: Background): string => backgroundMeta(bg).accent

/** 배경 → fluid(오로라) 팔레트 — 비-우주 배경(CosmosScene)이 소비. 단일 출처(옛 paletteForTheme 대체). */
export const paletteForBackground = (bg: Background): CosmosPalette => backgroundMeta(bg).palette
