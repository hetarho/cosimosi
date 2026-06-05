import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { UniverseCanvas, useCameraMode } from '@/widgets/universe-canvas'
import { MemoryForm } from '@/features/record-memory'
import { MemoryPanel, useRecallStore } from '@/features/recall'
import { getUniverse, useMemoryStore } from '@/entities/memory'

// The universe shell (spec 10, extended by 11): full-screen <UniverseCanvas/> (renders
// the stars from the memory store) + 2D HUD overlays (compose form, camera toggle,
// recall panel) OUTSIDE the R3F scene (Architecture §3.1). On mount we load the
// universe once via GetUniverse.
export function HomePage() {
  const mode = useCameraMode((s) => s.mode)
  const toggle = useCameraMode((s) => s.toggle)
  const starCount = useMemoryStore((s) => s.stars.length)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return // guard StrictMode double-invoke / re-renders (2.1)
    loadedRef.current = true
    void getUniverse().catch((e) => {
      console.error('[universe] GetUniverse failed', e)
    })
  }, [])

  // Flush any pending co-recall reinforcement when the tab is hidden/closed (1.3). The
  // model store is DOM-free (1.9); the window listeners live here in the page layer.
  // visibilitychange(hidden) fires more reliably than beforeunload (esp. on mobile),
  // and the transport uses keepalive so the request survives teardown.
  useEffect(() => {
    const flush = () => {
      void useRecallStore.getState().flush()
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])

  return (
    <div className="fixed inset-0" data-lenis-prevent>
      <UniverseCanvas />

      {/* HUD: 2D DOM overlays outside the canvas */}
      <div className="absolute top-4 left-4 z-10">
        <MemoryForm />
      </div>
      <div className="absolute right-4 bottom-4 z-10">
        <MemoryPanel />
      </div>
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Link
          to="/dormant"
          className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/80 backdrop-blur transition hover:bg-white/20"
        >
          잠든 별
        </Link>
        <button
          type="button"
          onClick={toggle}
          className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/80 backdrop-blur transition hover:bg-white/20"
        >
          카메라: {mode === 'nebula' ? '성운(전체 조망)' : '회상(근접 항해)'}
        </button>
      </div>

      {starCount === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-12 z-10 text-center">
          <p className="text-sm text-white/55">
            아직 별이 없어요. 첫 일기를 적어 첫 별을 띄워보세요.
          </p>
        </div>
      )}
    </div>
  )
}
