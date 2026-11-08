import { useCallback, useEffect, useState } from 'react'

import { measureAnchor, useSequenceAnchorRegistry, type SequenceRect } from '@cosimosi/sequence'

import type { DemoSurface } from './demo-surface.machine.ts'
import type { DecorationTourStage } from './decoration-tour.ts'
import type { DemoPhaseKey } from './recall-panel.ts'
import { demoRingTarget } from './ring-target.ts'
import { tutorialInteractiveAnchors } from './run-machine.ts'

export interface DemoGuideInputs {
  readonly beat: DemoPhaseKey
  readonly surface: DemoSurface
  readonly decorationStage: DecorationTourStage
  /** The drafted diary's split state; null with no draft on the sheet. */
  readonly splitRevealed: boolean | null
  readonly memoryCount: number
  /** The engine's own step anchor; it doubles as the "layout settled / window resized" signal. */
  readonly engineRect: SequenceRect | null
  readonly remeasure: () => void
}

/**
 * Where the tutorial chrome lands on the page: the mask's hole and the ring's rect. Both are
 * measured through the same anchor registry the engine reads, after the commits that move them.
 */
export function useDemoGuide({
  beat,
  surface,
  decorationStage,
  splitRevealed,
  memoryCount,
  engineRect,
  remeasure,
}: DemoGuideInputs) {
  // The chrome's layout moves when the phase, the draft or a surface does — the split rows appear,
  // a dialog mounts, launched rows arrive — and the engine cannot see any of that (a registry change
  // is its only signal). Re-measure after those commits, or the ring keeps pointing at the current
  // control's stale position. Keyed on primitives only: an object dep that changed identity per
  // render would turn this effect's own state write (the measure token) into an update loop.
  const surfaceKey = surfaceIdentity(surface)
  const target = demoRingTarget({ beat, surface, splitRevealed, decorationStage })
  const targetKey = target === null ? 'engine' : target.kind === 'none' ? 'none' : target.anchor
  // The override target's own registry entry. The engine re-measures only its step anchor, so a
  // walk target that mounts (or remounts) after the walk reached it — the recall result's way out
  // arrives once the confirm lands — is seen here through its handle's identity. A registry change
  // for any other anchor selects the same handle and re-renders nothing.
  const targetHandle = useSequenceAnchorRegistry((state) =>
    targetKey === 'engine' || targetKey === 'none' ? undefined : state.anchors.get(targetKey),
  )
  useEffect(() => {
    remeasure()
  }, [beat, remeasure, splitRevealed, memoryCount, surfaceKey, targetKey])

  // A host remeasure (a resize, the caption reserving room above a modal) moves controls the engine
  // may not be measuring: while a walk's sheet is up, the step's own anchor can be unmounted, and an
  // engine rect that stays null carries no signal. The guide calls this instead, so the page's own
  // measures below hear it too.
  const [layoutToken, setLayoutToken] = useState(0)
  const remeasureGuide = useCallback(() => {
    remeasure()
    setLayoutToken((token) => token + 1)
  }, [remeasure])

  // The mask's hole: the union box of every control the current beat opens — one lit region cut out
  // of one covering layer. No hole (the sky beat, an unmeasured mount, free play) means no mask — a
  // blackout with nothing lit would say "wait", and no beat here means that.
  const [hole, setHole] = useState<{
    readonly key: string
    readonly rect: SequenceRect | null
  }>({ key: '', rect: null })
  const maskKey = `${beat}:${surfaceKey}:${targetKey}`
  useEffect(() => {
    const anchors =
      beat === 'freePlay' || targetKey === 'none'
        ? null
        : targetKey !== 'engine'
          ? [targetKey]
          : beat === 'ornament_taster'
            ? ['decorate-action']
            : tutorialInteractiveAnchors(beat)
    if (!anchors || anchors.length === 0) return
    let live = true
    void Promise.all(anchors.map((anchor) => measureAnchor(anchor))).then((rects) => {
      if (!live) return
      const boxes = rects.filter((rect): rect is SequenceRect => rect !== null)
      setHole({ key: maskKey, rect: boxes.length > 0 ? unionSequenceRects(boxes) : null })
    })
    return () => {
      live = false
    }
  }, [
    beat,
    engineRect,
    layoutToken,
    splitRevealed,
    memoryCount,
    surfaceKey,
    targetKey,
    targetHandle,
    maskKey,
  ])
  // A hole measured for another beat is no hole for this one.
  const maskHole = hole.key === maskKey && beat !== 'freePlay' ? hole.rect : null

  // A page-side view override of the engine's anchor, for the beats whose work walks across a surface
  // (`demoRingTarget`). The engine's own anchor stays what the script says.
  const [measured, setMeasured] = useState<{
    readonly key: string
    readonly rect: SequenceRect | null
  }>({ key: 'engine', rect: null })
  useEffect(() => {
    if (targetKey === 'engine' || targetKey === 'none') return
    let live = true
    void measureAnchor(targetKey).then((rect) => {
      if (live) setMeasured({ key: targetKey, rect })
    })
    return () => {
      live = false
    }
  }, [engineRect, layoutToken, targetKey, targetHandle])

  // An unregistered target has no rect, whatever an earlier handle measured.
  const guideAnchorRect =
    targetKey === 'engine'
      ? engineRect
      : targetKey === 'none' || targetHandle === undefined
        ? null
        : measured.key === targetKey
          ? measured.rect
          : null
  return { maskHole, guideAnchorRect, remeasure: remeasureGuide }
}

// One string per distinct open surface, so effects can key on it without an object dependency.
function surfaceIdentity(surface: DemoSurface): string {
  switch (surface.kind) {
    case 'memory':
      return `memory:${surface.memoryId}`
    case 'recall':
      return `recall:${surface.memoryId}:${surface.applied}`
    case 'reading':
      return `reading:${surface.diaryId}`
    default:
      return surface.kind
  }
}

// The union box of every measured rect — the mask's lit region when a beat opens a control cluster.
function unionSequenceRects(rects: readonly SequenceRect[]): SequenceRect {
  const x = Math.min(...rects.map((rect) => rect.x))
  const y = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))
  return { x, y, width: right - x, height: bottom - y }
}
