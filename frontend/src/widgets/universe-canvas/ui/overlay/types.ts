// Shared handles for the universe-overlay (spec 37). Each universe runs its OWN force-sim
// (constitution §3 — coordinates emerge per universe) into a local positions buffer; the bridge
// reads both buffers per frame to span them. The handle exposes the live buffer + an id→row map
// + the world-space group offset, so the bridge can resolve world coordinates = local + offset.
import type { MutableRefObject } from 'react'

export interface OverlayHandle {
  /** This universe's live force-sim positions buffer (local coords, before the group offset). */
  positionsRef: MutableRefObject<Float32Array | null>
  /** star id → buffer row (== sim.ids order == the stars-array order). */
  idIndex: Map<string, number>
  /** the world-space offset this universe's <group> is rendered at (local + offset = world). */
  offset: readonly [number, number, number]
}
