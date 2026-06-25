// Camera-mode identifiers shared by navigation logic and the renderer setup.
// This file MUST NOT import three / React / DOM.

/** Camera framing (internal developer identifiers — kept stable for impl). USER-facing names
 *  (change 08): `nebula` → "멀리서 내 우주 보기"(whole-universe overview: orbit·pan·zoom), `recall` →
 *  "별들 가까이서 탐험하기"(free close-up navigation as a moving light). ⚠️ `recall` here is the CAMERA
 *  mode only — distinct from the RecallMemory DOMAIN action (2초 dwell 인출), which keeps its "회상"
 *  name. The UI/policy use the new names; these enum strings are dev-only. */
export type CameraMode = 'nebula' | 'recall'
