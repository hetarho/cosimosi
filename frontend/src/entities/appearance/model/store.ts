// 앱 전역 시각 설정 store(테마 + 별 오브제 형태). 웹 전용 사용자 선호라 localStorage에 지속한다.
// 랜딩과 우주(universe) 양쪽이 이 entity를 구독해 같은 테마/형태를 반영한다.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type StarObject, STAR_OBJECTS, DEFAULT_OBJECT } from '@/entities/star/@x/appearance'
import type { Theme } from './types'
import { THEMES, DEFAULT_THEME } from './themes'

const THEME_IDS = new Set<Theme>(THEMES.map((t) => t.id))
const OBJECT_IDS = new Set<StarObject>(STAR_OBJECTS.map((o) => o.id))

const STORAGE_KEY = 'cosimosi.appearance'
const LEGACY_KEY = 'cosimosi.landing.theme' // 랜딩 전용 시절(분리 이전) 키

interface AppearanceState {
  theme: Theme
  object: StarObject
  setTheme: (id: Theme) => void
  setObject: (id: StarObject) => void
}

/**
 * 옛 키(cosimosi.landing.theme)에서 1회 승계. 분리 이전 저장본은 {theme:'deepfield'|...} 하나로
 * 색+형태를 함께 운반했고, 그 값이 새 StarObject id와 동일하므로(deepfield/aurora/liquid/ember)
 * theme이 옛 4-값이면 그걸 object로 승계해 복귀 사용자의 별 '형태'를 보존한다(theme은 vast로 폴백).
 * 새 키가 이미 있으면 persist가 처리하므로 건드리지 않는다.
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

/** localStorage 지속(키: cosimosi.appearance). 새로고침해도 마지막 테마·형태 유지. */
export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      ...legacyInitial(),
      setTheme: (id) => set({ theme: id }),
      setObject: (id) => set({ object: id }),
    }),
    {
      name: STORAGE_KEY,
      // 알 수 없는/손상된 값이 저장돼 있어도 각 축의 기본값으로 폴백.
      merge: (persisted, current) => {
        const p = persisted as Partial<AppearanceState> | undefined
        return {
          ...current,
          theme: p?.theme && THEME_IDS.has(p.theme) ? p.theme : current.theme,
          object: p?.object && OBJECT_IDS.has(p.object) ? p.object : current.object,
        }
      },
    },
  ),
)
