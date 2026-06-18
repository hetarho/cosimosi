import { create } from 'zustand'

// 뷰포트 HUD 힌트(widgets/universe-canvas/model) — 하단 시트(작성 폼·기억 실험실)가 열려 있는지.
// 항행 "모드"가 아니라 투영 시프트(ViewOffsetController)를 위한 단순 UI 플래그라 머신이 아닌
// 작은 zustand로 둔다(triage: 단순 토글은 그대로). 페이지 HUD가 set, 컨트롤러가 read.
interface ViewportState {
  /** 모바일에서 하단 시트가 하단을 가리는 동안 true → 캔버스가 별을 화면 위 1/3로 올린다. */
  sheetOpen: boolean
  setSheetOpen: (sheetOpen: boolean) => void
  /** 체험 우주의 시간 이동 후 live force-sim을 중간 애니메이션 없이 정착 좌표로 밀어 넣는 신호. */
  quietSettleSeq: number
  requestQuietSettle: () => void
}

export const useViewport = create<ViewportState>((set) => ({
  sheetOpen: false,
  setSheetOpen: (sheetOpen) => set({ sheetOpen }),
  quietSettleSeq: 0,
  requestQuietSettle: () => set((s) => ({ quietSettleSeq: s.quietSettleSeq + 1 })),
}))
