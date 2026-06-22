// Public API for the shared r3f lib.
export { useOrbitControls } from './controls'
export {
  asWebGPURenderer,
  createRenderer,
  createRendererFactory,
  rendererBackend,
  RendererUnavailableError,
  useWebGPURenderer,
} from './renderer'
export {
  asFloatNode,
  asVec2Node,
  asVec3Node,
  attributeFloatNode,
  attributeVec2Node,
  attributeVec3Node,
  uniformColorNode,
} from './tsl'
// 셰이더 아트 툴킷(plan 50) — 도메인 무관 절차적 기법(이펙트+오브젝트 패밀리).
export * from './shader-art'
// dev 라이브 셰이더 튜너(스캐폴딩) — 매직넘버를 uniform으로 노출해 슬라이더로 즉시 조절.
export { TUNE, TUNE_KNOBS, getTune, setTune, resetTune, tuneSnapshot, type TuneKnob } from './tuner'
export type { OrbitControlsHandle } from './controls'
export type { CameraMode } from './types'
