// 감정색 온보딩(spec 45)의 순수 helper — React/DOM/three import 금지(헌법4: 모바일 재사용 가능한 순수 model).
// 색의 단일 출처는 shared/config/mood(MOOD_PALETTE) — 추천 hex는 여기서 파생하고 별도 테이블을 두지 않는다.
// 완료 판정은 "13 mood 전부 유효한 #RRGGBB"이며, 저장값은 대문자 #RRGGBB로 정규화한다.
import { MOOD_PALETTE, type Mood, type RGB } from '@/shared/config'

/** 13 canonical mood — 감정 사분면 순서(HAP → LAP → HAN → LAN → center, spec 29). 목록·미리보기 순서의 단일 출처. */
export const MOOD_ORDER: readonly Mood[] = [
  'joy',
  'excitement',
  'love', // HAP
  'calm',
  'gratitude',
  'relief', // LAP
  'anger',
  'fear',
  'stress', // HAN
  'sad',
  'tired',
  'emptiness', // LAN
  'neutral', // center
]

/** linear-RGB(0..1) → "#RRGGBB"(대문자). hexToRgb(mood.ts)의 역 — 8비트 직접 매핑이라 추천색이 왕복 보존된다. */
export function rgbToHex(rgb: RGB): string {
  const ch = (c: number) =>
    Math.round(Math.max(0, Math.min(1, c)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${ch(rgb[0])}${ch(rgb[1])}${ch(rgb[2])}`.toUpperCase()
}

/** "#RRGGBB"(엄격) 여부 — 대소문자 hex 허용. */
export function isHexColor(s: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(s)
}

/** 입력을 대문자 "#RRGGBB"로 정규화(앞 # 선택·공백 허용 — 붙여넣기 대비). 형식 아니면 null. */
export function normalizeHex(s: string): string | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(s.trim())
  return m ? `#${m[1].toUpperCase()}` : null
}

/** 보편적 추천 팔레트 — MOOD_PALETTE를 hex로 변환(추천 테이블 하드코딩 금지). mood당 1색. */
export function recommendedEmotionColors(): Record<Mood, string> {
  const out = {} as Record<Mood, string>
  for (const m of MOOD_ORDER) out[m] = rgbToHex(MOOD_PALETTE[m])
  return out
}

/** 완료 판정: 13 mood 전부에 유효한 #RRGGBB가 있나(spec 45 A). unknown mood·malformed·누락은 미완료.
 *  최초 로그인 여부가 아니라 *서버 설정 내용*으로만 판정한다(A2). */
export function isCompleteEmotionColors(colors: Record<string, string> | undefined): boolean {
  if (!colors) return false
  return MOOD_ORDER.every((m) => {
    const c = colors[m]
    return typeof c === 'string' && isHexColor(c)
  })
}

/** 편집 draft 초기값 — mood마다 서버 색(유효하면)을 우선, 없으면 추천색(A4). 항상 13 mood 완전체를 돌려준다. */
export function mergeEmotionColorDraft(
  serverColors: Record<string, string> | undefined,
): Record<Mood, string> {
  const rec = recommendedEmotionColors()
  const out = {} as Record<Mood, string>
  for (const m of MOOD_ORDER) {
    const sv = serverColors?.[m]
    const norm = sv ? normalizeHex(sv) : null
    out[m] = norm ?? rec[m]
  }
  return out
}
