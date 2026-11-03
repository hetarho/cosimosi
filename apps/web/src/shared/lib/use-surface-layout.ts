import { useEffect, useState } from 'react'
import { SURFACE_PANEL_ATTR } from '@cosimosi/ui'
import { awaitArrival, measuredBox, type MeasuredBox } from './measure-arrival.ts'

export interface SurfaceLayout {
  readonly right: number
  readonly bottom: MeasuredBox | null
  readonly footer: number
}

const CLEAR: SurfaceLayout = { right: 0, bottom: null, footer: 0 }
const EDGE_TOLERANCE = 2

/** Edge panels reserve space for the scene and for guidance painted above those panels. */
export function measureSurfaceLayout(
  panels: readonly Element[],
  width: number,
  height: number,
): SurfaceLayout {
  let right = 0
  let bottom: MeasuredBox | null = null
  for (const panel of panels) {
    if (!panel.isConnected) continue
    const box = measuredBox(panel)
    if (!box) continue
    const reachesRight = box.x + box.width >= width - EDGE_TOLERANCE
    const reachesBottom = box.y + box.height >= height - EDGE_TOLERANCE
    if (
      reachesRight &&
      box.y <= EDGE_TOLERANCE &&
      box.height >= height - EDGE_TOLERANCE &&
      box.width < width * 0.8
    ) {
      right = Math.max(right, width - Math.max(0, box.x))
    }
    if (
      reachesBottom &&
      box.x <= EDGE_TOLERANCE &&
      box.width >= width - EDGE_TOLERANCE &&
      box.y < height &&
      (!bottom || box.y < bottom.y)
    ) {
      bottom = box
    }
  }
  let footer = 0
  for (const control of document.querySelectorAll('[data-scene-footer]')) {
    const box = measuredBox(control)
    if (box) footer = Math.max(footer, height - box.y)
  }
  return { right, bottom, footer }
}

export function useSurfaceLayout(active = true): SurfaceLayout {
  const [layout, setLayout] = useState<SurfaceLayout>(CLEAR)
  useEffect(() => {
    if (!active) return
    let live = true
    let scheduled = 0
    let revision = 0
    const observed = new Set<Element>()
    const resize =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => schedule())
    const read = async () => {
      scheduled = 0
      const ownRevision = ++revision
      const panels = [...document.querySelectorAll(`[${SURFACE_PANEL_ATTR}]`)]
      for (const panel of observed)
        if (!panels.includes(panel)) {
          resize?.unobserve(panel)
          observed.delete(panel)
        }
      for (const panel of panels)
        if (!observed.has(panel)) {
          observed.add(panel)
          resize?.observe(panel)
        }
      await Promise.all(panels.map(awaitArrival))
      if (!live || ownRevision !== revision) return
      const next = measureSurfaceLayout(panels, window.innerWidth, window.innerHeight)
      setLayout((current) => (sameLayout(current, next) ? current : next))
    }
    function schedule() {
      if (!scheduled)
        scheduled = requestAnimationFrame(() => {
          void read()
        })
    }
    void read()
    const mutations = new MutationObserver(schedule)
    mutations.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', schedule)
    return () => {
      live = false
      cancelAnimationFrame(scheduled)
      mutations.disconnect()
      resize?.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [active])
  return active ? layout : CLEAR
}

function sameLayout(a: SurfaceLayout, b: SurfaceLayout): boolean {
  if (a.right !== b.right || a.footer !== b.footer) return false
  if (!a.bottom || !b.bottom) return a.bottom === b.bottom
  return (
    a.bottom.x === b.bottom.x &&
    a.bottom.y === b.bottom.y &&
    a.bottom.width === b.bottom.width &&
    a.bottom.height === b.bottom.height
  )
}
