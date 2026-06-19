// 투어 target(`data-tour-id`)의 화면 위 사각형을 추적하는 ui hook(plan 48). DOM을 직접 읽으므로
// model이 아니라 ui 인접 hook이다(순수 step 정의 steps.ts와 분리 — 헌법 §4). 표면이 열리고
// 팝오버가 애니메이트되며 target 위치가 바뀌므로, 마운트 동안 rAF로 rect를 따라가되 값이
// 실제로 변할 때만 상태를 갱신한다(불필요한 리렌더 방지). target을 못 찾으면 null(중앙 fallback).
import { useEffect, useState } from 'react'
import type { TourTargetId } from '../model/steps'

export interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

const SAME = (a: TargetRect | null, b: TargetRect | null) =>
  a === b ||
  (a != null &&
    b != null &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5)

function measure(target: TourTargetId | null): TargetRect | null {
  if (typeof document === 'undefined' || target == null) return null
  const el = document.querySelector(`[data-tour-id="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null // 숨겨진(미렌더) target
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

/** target rect를 rAF로 추적한다. target이 null이거나 DOM에 없으면 null을 돌려준다. */
export function useTourTarget(target: TourTargetId | null): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(() => measure(target))

  useEffect(() => {
    if (typeof window === 'undefined') return
    // rAF 루프로 target rect를 따라간다(표면/팝오버 애니메이션에도 spotlight가 붙어 있게). 측정·상태
    // 갱신은 rAF 콜백 안에서만 일어나(effect 본문 직접 setState 아님) 값이 실제로 변할 때만 리렌더한다.
    let raf = 0
    const tick = () => {
      setRect((prev) => {
        const next = measure(target)
        return SAME(prev, next) ? prev : next
      })
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [target])

  return rect
}
