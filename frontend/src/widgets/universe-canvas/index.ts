// Public API for the universe-canvas widget.
export { UniverseCanvas } from './ui/UniverseCanvas'
export { UniverseGrain } from './ui/UniverseGrain'
// 겹쳐보기(spec 37): 두 우주를 한 씬에 띄우는 오버레이 + 공명 다리 타입. 페이지가 단일 우주(UniverseCanvas)
// 대신 마운트한다(overlay 상태 진입 시). navigation.machine이 같은 위젯이라 여기서 함께 노출한다.
export { UniverseOverlay, type UniverseOverlayProps, type OverlaySide } from './ui/overlay/UniverseOverlay'
export { OverlayComparePanel, type OverlayComparePanelProps } from './ui/overlay/OverlayComparePanel'
export type { Bridge } from './ui/overlay/ResonanceBridges'
// 항행(카메라) 머신(spec 39 P2) — 구 useCameraMode 대체. 페이지가 토글·fly-to·D-pad를 보내고,
// 모드 라벨/NavPad 가시성에 selectHeadingMode를 쓴다. 겹쳐보기(spec 37)는 ENTER/EXIT_OVERLAY + overlay 상태.
export {
  navigationActor,
  selectHeadingMode,
  selectIsOverlay,
  selectIsFramingPair,
} from './model/navigation.machine'
export { useViewport } from './model/use-viewport'
// 데모 투어(plan 48·change 12) 항해 실습 관찰용 단조 누적 카운터 — 페이지가 sampler로 감싸 투어에 넘긴다.
export { navTravel, type NavTravel } from './model/navigation-input'
