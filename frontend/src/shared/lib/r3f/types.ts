// Pure renderer-abstraction types — the mobile-reusable boundary (constitution §4,
// Architecture §3.2). This file MUST NOT import three / React / DOM: it is the
// domain-neutral graph model + renderer port, so the web (R3F/WebGPU) and a future
// mobile target (react-native-webgpu / Filament) can share it and swap only the
// platform implementation behind GraphRenderer.

/** A star in the universe graph. Visuals (size/color/brightness) are derived from
 *  these fields client-side; coordinates are NOT here (they emerge from the
 *  force-sim — constitution §3). */
export interface StarNode {
  id: string
  intensity: number
  mood: string
}

/** A weighted, undirected synapse between two stars. */
export interface SynapseEdge {
  aId: string
  bId: string
  weight: number
}

/** Camera framing: `nebula` = zoom-limited whole-universe overview;
 *  `recall` = free close-up navigation. */
export type CameraMode = 'nebula' | 'recall'

/** The renderer abstraction boundary (Architecture §3.2). The web implementation
 *  is R3F + WebGPU (widgets/universe-canvas); a mobile target swaps only this. */
export interface GraphRenderer {
  setGraph(nodes: StarNode[], edges: SynapseEdge[]): void
  setCameraMode(mode: CameraMode): void
  dispose(): void
}
