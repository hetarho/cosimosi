// 투어 target의 화면 위 사각형을 추적하는 ui hook(plan 48·change 34). 두 종류의 target을 받는다:
//   • DOM target(`data-tour-id`) — HUD·시트·폼·패널. rAF로 rect를 따라간다(표면/팝오버 애니메이션에도
//     spotlight가 붙어 있게). 값이 실제로 변할 때만 상태를 갱신한다(불필요한 리렌더 방지).
//   • canvas-star — 3D 캔버스 안 생성/fixture 별. DOM rect가 없어(헌법8) universe-canvas가 화면 rect를
//     shared 레지스트리(tour-target)에 투영해 싣고, 여기선 그 스냅샷을 구독한다(A7·A8).
// DOM을 직접 읽으므로 model이 아니라 ui 인접 hook이다(순수 step 정의 steps.ts와 분리 — 헌법 §4).
import { useEffect, useState, useSyncExternalStore } from 'react'
import { getTourStarRect, subscribeTourStarRect } from '@/shared/lib'
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

/** 캔버스 별 rect — shared 레지스트리(universe-canvas projector가 투영해 싣는다)를 구독한다. */
function useCanvasStarRect(): TargetRect | null {
  return useSyncExternalStore(subscribeTourStarRect, getTourStarRect, () => null)
}

/** DOM `data-tour-id` rect를 rAF로 추적한다. target이 null이거나 DOM에 없으면 null. */
function useDomRect(target: TourTargetId | null): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(() => measure(target))
  useEffect(() => {
    if (typeof window === 'undefined') return
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

/** 현재 phase target의 화면 rect. canvas-star는 캔버스 투영 레지스트리, 그 외는 DOM에서. 못 찾으면 null. */
export function useTourTarget(target: TourTargetId | null): TargetRect | null {
  const isCanvasStar = target === 'canvas-star'
  const starRect = useCanvasStarRect()
  // DOM hook은 canvas-star일 땐 null target으로 돌려(측정 안 함) hook 순서를 안정 유지한다(조건부 hook 금지).
  const domRect = useDomRect(isCanvasStar ? null : target)
  return isCanvasStar ? starRect : domRect
}
