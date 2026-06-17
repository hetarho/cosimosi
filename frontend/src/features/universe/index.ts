// Public API for the universe shell feature (spec 31 — 우주 셸 + 오버레이 네비게이션). The
// persistent universe canvas (`/`) hosts list/explore overlays (dormant/diary) as 2D HUD overlays
// over the never-unmounted WebGPU canvas (shared/ui OverlayHost). This store is the single
// registry of which panel is up + its peek state; the page mirrors `panel` into `?panel=`.
// Named exports only (FSD public-API rule).
export { useShellStore, type Panel } from './model'
