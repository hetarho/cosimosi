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

/** Camera framing (internal developer identifiers — kept stable for impl). USER-facing names
 *  (change 08): `nebula` → "멀리서 내 우주 보기"(whole-universe overview: orbit·pan·zoom), `recall` →
 *  "별들 가까이서 탐험하기"(free close-up navigation as a moving light). ⚠️ `recall` here is the CAMERA
 *  mode only — distinct from the RecallMemory DOMAIN action (2초 dwell 인출), which keeps its "회상"
 *  name. The UI/policy use the new names; these enum strings are dev-only. */
export type CameraMode = 'nebula' | 'recall'

/** The renderer abstraction boundary (Architecture §3.2). The web implementation
 *  is R3F + WebGPU (widgets/universe-canvas); a mobile target swaps only this. */
export interface GraphRenderer {
  setGraph(nodes: StarNode[], edges: SynapseEdge[]): void
  setCameraMode(mode: CameraMode): void
  dispose(): void
}
