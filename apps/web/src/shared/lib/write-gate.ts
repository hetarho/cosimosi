// 겹쳐보기(spec 37) 쓰기 게이트 — overlay는 순수 읽기 뷰라 쓰기 RPC가 0건이어야 한다(3.1 / DoD
// "network tab: 0 write RPCs in overlay"). 그 불변식의 단일 출처는 navigation 머신의 `overlay`
// 상태지만, FSD 하향 의존상 features(쓰기 경로 recallMemory·reinforceLinks)는 widgets의 navigation
// 머신을 직접 읽을 수 없다. 그래서 머신이 overlay 진입/이탈에서 이 shared 게이트를 set하고(상태가
// 출처), 쓰기 경로가 read해 막는다(파생 백스톱) — 어떤 UI가 마운트돼 있든 상태 기준으로 쓰기가 차단된다.
// 순수 모듈(three/React/DOM 미의존, 헌법4). 데모는 어차피 RPC가 없어(no-op) 무관.
let overlayWriteBlocked = false

/** navigation 머신의 overlay 상태 entry/exit가 호출 — overlay 동안 true. */
export function setOverlayWriteBlocked(blocked: boolean): void {
  overlayWriteBlocked = blocked
}

/** 쓰기 경로(recallMemory·reinforceLinks)가 진입 시 확인 — true면 쓰기를 건너뛴다. */
export function isWriteBlocked(): boolean {
  return overlayWriteBlocked
}
