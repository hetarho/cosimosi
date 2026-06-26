// 첫 별 튜토리얼 캔버스 별 target 레지스트리(change 34·job 50) — 3D 캔버스 안 별엔 DOM rect가 없으므로
// (헌법8 — 씬 안 <Html> 금지) universe-canvas가 그 별의 live force-sim 좌표를 화면 rect로 투영해 여기 싣고,
// demo-tour overlay가 그 rect로 spotlight를 그린다. 두 위젯이 서로를 import하지 않게 shared의 순수 pub-sub로
// 가운데서 잇는다(React/DOM/three 미의존, 헌법4 — 값만 들고 구독만 받는다).

export interface TourStarRect {
  top: number
  left: number
  width: number
  height: number
}

/** 페이지가 가리키는 생성/fixture 별 id(없으면 null) — universe-canvas projector가 이 id의 별만 투영한다. */
let targetId: string | null = null
/** projector가 매 프레임 갱신하는 화면 rect(별이 화면 밖/미해결이면 null). */
let rect: TourStarRect | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const cb of listeners) cb()
}

/** rect 변경 구독(useSyncExternalStore 호환) — getTourStarRect 스냅샷이 바뀌면 콜백을 부른다. */
export function subscribeTourStarRect(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** 투영할 별 id를 정한다(페이지) — 바뀌면 이전 rect를 비워 옛 별 잔상을 막는다. */
export function setTourStarTarget(id: string | null): void {
  if (targetId === id) return
  targetId = id
  rect = null
  emit()
}

/** 현재 투영 대상 별 id(universe-canvas projector가 매 프레임 읽는다). */
export function getTourStarTarget(): string | null {
  return targetId
}

/** 화면 rect를 싣는다(universe-canvas projector). 같은 값이면 무발화(불필요한 리렌더 방지). */
export function publishTourStarRect(next: TourStarRect | null): void {
  const same =
    rect === next ||
    (rect != null &&
      next != null &&
      Math.abs(rect.top - next.top) < 0.5 &&
      Math.abs(rect.left - next.left) < 0.5 &&
      Math.abs(rect.width - next.width) < 0.5 &&
      Math.abs(rect.height - next.height) < 0.5)
  if (same) return
  rect = next
  emit()
}

/** 현재 화면 rect 스냅샷(demo-tour overlay가 useSyncExternalStore로 읽는다). */
export function getTourStarRect(): TourStarRect | null {
  return rect
}
