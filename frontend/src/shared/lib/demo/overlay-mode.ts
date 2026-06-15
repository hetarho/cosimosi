// 겹쳐보기(spec 37) 데모 모드 스위치 — demo-sim 패널의 "겹쳐보기" 버튼이 켜고, 데모를 호스팅하는
// 페이지(home)가 읽어 단일 우주 대신 UniverseOverlay(두 페르소나 우주 + 빛의 다리)를 마운트한다.
// 패널(widget)은 다른 위젯(universe-canvas)을 직접 import할 수 없으므로(FSD 동일 레이어 금지), 이
// 가벼운 플래그로 페이지에 의사만 전달한다. zustand는 model 계층에서 안전(three/DOM 미의존, 헌법4).
import { create } from 'zustand'

interface DemoOverlayMode {
  on: boolean
  setOn: (on: boolean) => void
}

export const useDemoOverlay = create<DemoOverlayMode>((set) => ({
  on: false,
  setOn: (on) => set({ on }),
}))
