import { m } from '../../../shared/i18n/index.ts'

// The reserved [P4] staging slot: it names the non-meaning layers (background · theme · effect ·
// camera mood) and states the boundary, and deliberately renders NO control — the guarantee that
// staging can never touch "color = emotion", a star's emotion, or any position/strength is
// structural, not copy ([P2][I11]). What later staging work makes user-choosable is the build-time
// `rendering.active_skin` / `useSkin` seam the rendering foundation ([14]) reserved (packages/3d-renderer) — named here,
// not consumed, not modified.
export function StagingSection() {
  return (
    <div aria-disabled className="flex flex-col gap-2 opacity-60 select-none">
      <p className="text-sm text-text">{m.settings_staging_items()}</p>
      <p className="text-sm text-text-muted">{m.settings_staging_notice()}</p>
      <p className="text-sm text-text-muted">{m.settings_staging_boundary()}</p>
    </div>
  )
}
