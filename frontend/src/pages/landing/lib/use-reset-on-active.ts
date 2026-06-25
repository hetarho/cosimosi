import { useState } from 'react'

/**
 * 장이 비활성 → 활성으로 바뀌는 순간 로컬 인터랙션 상태를 초기화한다(스크롤로 다시 들어오면 처음부터 시연).
 * "이전 prop과 다르면 렌더 중 setState"라는 React 권장 패턴 — 효과(effect) 안 동기 setState(연쇄 렌더)
 * 대신 렌더 단계에서 즉시 조정해 한 번에 수렴한다. reset 콜백은 렌더 중 호출되므로 setState만 담는다(부수효과 금지).
 */
export function useResetOnActive(isActive: boolean, reset: () => void): void {
  const [wasActive, setWasActive] = useState(isActive)
  if (isActive !== wasActive) {
    setWasActive(isActive)
    if (isActive) reset()
  }
}
