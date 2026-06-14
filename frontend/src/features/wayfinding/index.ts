// Public API for the wayfinding feature (spec 28 — 원본 일기·엔그램·별 길찾기). Named exports
// only (FSD public-API rule). The universe-canvas widget consumes the store to drive the
// frame-all camera + star/synapse highlight; the page wires the diary list / recall panel to
// useWayfindingStore.frameRecord (features don't import features — the page composes).
export {
  useWayfindingStore,
  frameTarget,
  FRAME_MARGIN,
  FRAME_MIN_DISTANCE,
  type FrameTarget,
} from './model'
