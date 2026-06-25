// Public API for the demo-tour widget (plan 48·change 13) — named exports만(FSD 공개 API 규칙).
export { DemoGuidedTour, type DemoGuidedTourProps } from './ui/DemoGuidedTour'
// 진행 머신(change 13) — 페이지가 provide(navSampler)·이벤트 send·노출 상태 파생에 쓴다. selector는
// 컴포넌트 밖 정의(참조 안정). DemoGuidedTour는 같은 위젯이라 ./model에서 직접 더 쓰고, 여기선 페이지가
// 필요로 하는 것만 노출한다.
export {
  tourMachine,
  type NavSamplerInput,
  selectStepIndex,
  selectPhaseIndex,
  selectPhaseMode,
  selectIsDone,
  selectStepId,
  selectSurface,
  selectCameraLocked,
} from './model/tour.machine'
export {
  TOUR_STEPS,
  activeSteps,
  type TourStep,
  type TourPhase,
  type TourTargetId,
  type TourSurface,
  type TourAwait,
  type TourContext,
  type TourKind,
} from './model/steps'
