/** 테마별 별 오브제(CrystalStar/NebulaStar/LiquidStar/EmberStar)가 공유하는 props.
 *  모두 부모 svg viewBox 좌표계에 (cx,cy) 중심·반경 r로 박히는 `<g>`를 그린다. */
export interface StarVisualProps {
  /** 중심 좌표 (부모 svg viewBox 단위). */
  cx: number
  cy: number
  /** 코어 시각 반경. 블룸·스파이크는 이 값의 배수로 뻗는다. */
  r: number
  /** 의미 색(mood hex). 테마가 바뀌어도 의미 색은 보존된다. */
  color: string
  /** 0~1 밝기(감쇠·잠든 별). 기본 1. */
  brightness?: number
  /** 강조(hover/active) 시 더 또렷하게. */
  active?: boolean
  /** 결정론 시드 — 고유 형태를 빚는다. 같은 seed면 항상 같은 모양. */
  seed?: number
}
