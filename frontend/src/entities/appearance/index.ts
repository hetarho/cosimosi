// Public API for the appearance entity — 유저가 고른 시각 선호(테마 색 + 선택된 별 종류).
// 별 종류(StarObject/STAR_OBJECTS)는 star entity 소유 — 여기선 store가 그 '선택'만 운반한다.
export type { Theme, ThemeMeta } from './model/types'
export { THEMES, DEFAULT_THEME, themeAccent, themeBg } from './model/themes'
export { useAppearance } from './model/store'
