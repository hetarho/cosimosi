// 앱 전역 시각 설정 store. 테마·오브제는 *기기* 선호라 localStorage에 지속하고, 감정색
// 오버라이드(emotionColors)는 *per-user* 서버 값이라 메모리에만 둔다(공용 PC에 개인 데이터를
// 영속하지 않는다 — domain/data-sync 정책). 인증 세션이면 GetSettings로 시드되고(spec 30),
// 로그아웃·계정 전환·체험 전환 시 출처 리셋이 비운다. 랜딩·우주 양쪽이 이 entity를 구독한다.
// 위치 근거: §2.7상 theme은 app 후보지만, object(StarObject)가 도메인-비주얼이라 둘을 한 쌍으로
// 묶어 여기(entities/appearance) 둔다 — 여러 페이지가 같은 entity로 함께 구독한다.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type StarObject, STAR_OBJECTS, DEFAULT_OBJECT } from '@/entities/star/@x/appearance'
import type { SelfObject, Theme } from './types'
import { THEMES, DEFAULT_THEME } from './themes'
import { SELF_OBJECTS, DEFAULT_SELF_OBJECT } from './self-objects'

const THEME_IDS = new Set<Theme>(THEMES.map((t) => t.id))
const OBJECT_IDS = new Set<StarObject>(STAR_OBJECTS.map((o) => o.id))
const SELF_OBJECT_IDS = new Set<SelfObject>(SELF_OBJECTS.map((o) => o.id))

const STORAGE_KEY = 'cosimosi.appearance'
const LEGACY_KEY = 'cosimosi.landing.theme' // 레거시 마이그레이션용 구 저장 키

/** 서버가 내려준 시각 오버라이드(spec 30). theme/object가 비면 기존(기본) 값을 유지하고,
 *  emotionColors는 사용자가 바꾼 mood만 담는다(빈 맵 = 전부 기본 팔레트). */
export interface ServerAppearance {
  theme?: string
  object?: string
  emotionColors: Record<string, string>
}

interface AppearanceState {
  theme: Theme
  object: StarObject
  /** 중심 "나" 별의 형태(spec 38). `object`와 같은 기기-로컬 선호(서버 동기는 후속). */
  selfObject: SelfObject
  /** mood(소문자) → "#RRGGBB" 사용자 오버라이드. 서버 시드·메모리 전용. 빈 맵 = 전부 기본 팔레트. */
  emotionColors: Record<string, string>
  setTheme: (id: Theme) => void
  setObject: (id: StarObject) => void
  setSelfObject: (id: SelfObject) => void
  setEmotionColor: (mood: string, color: string) => void
  /** GetSettings 응답(오버라이드만)을 store에 머지 — 인증 세션에서 서버가 단일 진실. */
  applyServerSettings: (s: ServerAppearance) => void
  /** 출처 경계 리셋(로그아웃·계정 전환·체험 전환): per-user 감정색 오버라이드를 비운다. */
  resetServerSettings: () => void
}

/**
 * 구 키(cosimosi.landing.theme)에서 1회 승계한다. 구 저장본은 {theme:'deepfield'|...}로
 * 색+형태를 함께 담았고 그 값이 StarObject id(deepfield/aurora/liquid/ember)와 같으므로,
 * theme이 그 4-값이면 object로 승계하고 theme은 vast로 폴백한다.
 * 새 키가 이미 있으면 건드리지 않는다.
 */
function legacyInitial(): { theme: Theme; object: StarObject } {
  const base = { theme: DEFAULT_THEME, object: DEFAULT_OBJECT }
  try {
    if (typeof localStorage === 'undefined') return base
    if (localStorage.getItem(STORAGE_KEY)) return base
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return base
    const s = (JSON.parse(raw)?.state ?? {}) as { theme?: string; object?: string }
    const theme = s.theme && THEME_IDS.has(s.theme as Theme) ? (s.theme as Theme) : DEFAULT_THEME
    const object =
      s.object && OBJECT_IDS.has(s.object as StarObject)
        ? (s.object as StarObject)
        : s.theme && OBJECT_IDS.has(s.theme as StarObject)
          ? (s.theme as StarObject)
          : DEFAULT_OBJECT
    return { theme, object }
  } catch {
    return base
  }
}

/** localStorage 지속(키: cosimosi.appearance) — 단 기기 선호(테마·오브제)만. */
export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      ...legacyInitial(),
      selfObject: DEFAULT_SELF_OBJECT,
      emotionColors: {},
      setTheme: (id) => set({ theme: id }),
      setObject: (id) => set({ object: id }),
      setSelfObject: (id) => set({ selfObject: id }),
      setEmotionColor: (mood, color) =>
        set((s) => ({ emotionColors: { ...s.emotionColors, [mood]: color } })),
      applyServerSettings: (sv) =>
        set((s) => {
          // 색 내용이 그대로면 참조를 유지 — 테마·오브제만 바뀐 쓰기/재시드에서 별·시냅스 색
          // 전체 재베이킹(StarField aMood·UniverseSynapses colById)을 피한다.
          const keys = Object.keys(sv.emotionColors)
          const sameColors =
            keys.length === Object.keys(s.emotionColors).length &&
            keys.every((k) => sv.emotionColors[k] === s.emotionColors[k])
          return {
            theme: sv.theme && THEME_IDS.has(sv.theme as Theme) ? (sv.theme as Theme) : s.theme,
            object:
              sv.object && OBJECT_IDS.has(sv.object as StarObject) ? (sv.object as StarObject) : s.object,
            emotionColors: sameColors ? s.emotionColors : sv.emotionColors,
          }
        }),
      resetServerSettings: () => set({ emotionColors: {} }),
    }),
    {
      name: STORAGE_KEY,
      // 기기 선호(테마·오브제·자아 별)만 영속 — emotionColors는 per-user라 메모리 전용(공용 PC 개인정보 미영속).
      partialize: (s) => ({ theme: s.theme, object: s.object, selfObject: s.selfObject }),
      // 알 수 없는/손상된 값이 저장돼 있어도 각 축의 기본값으로 폴백.
      merge: (persisted, current) => {
        const p = persisted as Partial<AppearanceState> | undefined
        return {
          ...current,
          theme: p?.theme && THEME_IDS.has(p.theme) ? p.theme : current.theme,
          object: p?.object && OBJECT_IDS.has(p.object) ? p.object : current.object,
          selfObject:
            p?.selfObject && SELF_OBJECT_IDS.has(p.selfObject) ? p.selfObject : current.selfObject,
        }
      },
    },
  ),
)
