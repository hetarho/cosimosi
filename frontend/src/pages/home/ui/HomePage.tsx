import { UniverseCanvas, useCameraMode } from '@/widgets/universe-canvas'

// Temporary full-screen mount of the universe shell (spec 06). fixed inset-0 so the
// canvas fills the viewport without collapsing under Lenis's content-driven height;
// data-lenis-prevent stops Lenis's smoothWheel from hijacking OrbitControls zoom.
export function HomePage() {
  const mode = useCameraMode((s) => s.mode)
  const toggle = useCameraMode((s) => s.toggle)
  return (
    <div className="fixed inset-0" data-lenis-prevent>
      <UniverseCanvas />
      {/* 2D HUD overlay (outside the R3F scene — constitution §4 allows DOM here,
          only forbids <Html> inside the scene). Lets the camera mode be toggled so
          the nebula↔recall zoom behavior is exercisable (acceptance 1.5/1.6). */}
      <button
        type="button"
        onClick={toggle}
        className="absolute top-4 right-4 z-10 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/80 backdrop-blur transition hover:bg-white/20"
      >
        카메라: {mode === 'nebula' ? '성운(전체 조망)' : '회상(근접 항해)'}
      </button>
    </div>
  )
}
