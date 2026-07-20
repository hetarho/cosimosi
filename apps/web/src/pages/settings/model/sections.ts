// The page's only model: the section order (계정 · 팔레트 · 연출 — the settings spec's fixed layout, [52]). Which
// component and title a section id resolves to is the ui's composition concern; no domain state
// lives at the page level.
export const SETTINGS_SECTIONS = ['account', 'palette', 'staging'] as const

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]
