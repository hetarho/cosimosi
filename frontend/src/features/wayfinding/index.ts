// Public API for the wayfinding feature (spec 28 — 원본 일기·엔그램·별 길찾기). Named exports
// only (FSD public-API rule). 강조/프레임 상태는 entities/memory의 focus 머신으로 이전했고(spec 39),
// 여기엔 frame-all 기하(frameTarget)만 남는다 — universe-canvas 위젯이 카메라 프레이밍에 쓴다.
export { frameTarget, FRAME_MARGIN, FRAME_MIN_DISTANCE, type FrameTarget } from './model'
