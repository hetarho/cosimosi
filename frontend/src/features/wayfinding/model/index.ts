// wayfinding/model — pure navigation model (frame-all geometry + highlight/frame state).
// No three/React/DOM (헌법4 / acceptance 1.10; verified by the spec-28 purity grep).
export { frameTarget, FRAME_MARGIN, FRAME_MIN_DISTANCE, type FrameTarget } from './frame'
export { useWayfindingStore } from './store'
