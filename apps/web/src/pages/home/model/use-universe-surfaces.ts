import { useCallback, useEffect, useState } from 'react'
import { focusActor } from '@/entities/memory'
import { useEvolutionStore } from '@/features/evolution'
import { isTypingTarget } from '../lib/keyboard'
import type { ExplorerTab } from '../ui/UniverseExplorerSheet'
import type { DemoPopover } from '../ui/DemoFreeModeControls'

// change 09 IA 표면 상태 — 우상단 햄버거 사이드바, 망원경 탐색 시트(일기/별 탭), 상단 중앙 HUD 숨김,
// 그리고 기존 결과/액션 표면(작성·공유·선물·보내기·꾸미기) + 데모 페르소나/시간 팝오버. 한 번에 하나의
// 표면만 띄우고(prepareOpen), 단일 Esc 라우터로 위에서부터 닫는다. 표면 토폴로지·게이팅을 한 곳에 모은다.
export function useUniverseSurfaces() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [explorerOpen, setExplorerOpen] = useState(false)
  const [explorerTab, setExplorerTab] = useState<ExplorerTab>('diary')
  const [uiHidden, setUiHidden] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [giftsOpen, setGiftsOpen] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  // 별 보내기(spec 36) — 회상 패널의 "이 별 보내기"가 memoryId를 넘겨 연다(비차단 Surface). 데모엔 서버가 없어 끈다.
  const [sendMemoryId, setSendMemoryId] = useState<string | null>(null)
  // 데모 페르소나/시간 팝오버(plan 47 — transient surface): 다른 표면이 열리면 닫힌다.
  const [demoPopover, setDemoPopover] = useState<DemoPopover>(null)

  const evolutionOpen = useEvolutionStore((s) => s.openFor != null)

  // 한 번에 하나의 표면만 — 새 표면을 열기 전에 나머지를 정리한다(특히 모바일 바텀시트 중첩 방지).
  // 변천사·별 보내기는 회상 위에서 의도적으로 겹치므로 여기서 닫지 않는다(회상에서 파생).
  const closeSurfaces = useCallback(() => {
    setSidebarOpen(false)
    setExplorerOpen(false)
    setComposeOpen(false)
    setShareOpen(false)
    setGiftsOpen(false)
    setAppearanceOpen(false)
    setSendMemoryId(null)
    setDemoPopover(null) // 데모 페르소나/시간 팝오버도 다른 표면이 열리면 닫는다(plan 47 — transient surface)
  }, [])
  // 기능 진입 — 정리 후 연다. 열려 있던 별 회상/일기 조망도 함께 풀어 한 표면만 남긴다(우주는 떠나지 않음).
  const prepareOpen = useCallback(() => {
    closeSurfaces()
    focusActor.send({ type: 'DISMISS' })
  }, [closeSurfaces])

  const openSidebar = () => {
    prepareOpen()
    setSidebarOpen(true)
  }
  const openExplorer = (tab: ExplorerTab) => {
    prepareOpen()
    setExplorerTab(tab)
    setExplorerOpen(true)
  }
  const openCompose = () => {
    prepareOpen()
    setComposeOpen(true)
  }
  const openShare = () => {
    prepareOpen()
    setShareOpen(true)
  }
  const openGifts = () => {
    prepareOpen()
    setGiftsOpen(true)
  }
  const openAppearance = () => {
    prepareOpen()
    setAppearanceOpen(true)
  }

  // HUD 숨김 토글(A13·A14) — 숨길 때 토글을 제외한 모든 HUD와 열린 표면/포커스를 정리한다. 캔버스는
  // 언마운트하지 않는다(uiHidden은 HUD DOM만 가린다). 보이기를 누르면 기본 HUD가 복귀한다.
  const toggleUiHidden = () => {
    setUiHidden((prev) => {
      const next = !prev
      if (next) {
        closeSurfaces()
        focusActor.send({ type: 'DISMISS' })
        useEvolutionStore.getState().close()
      }
      return next
    })
  }

  // 어떤 표면/사이드바가 떠 있거나 HUD가 숨겨졌으면 NavPad를 억제한다(구 panel!=null 대체).
  const surfaceUp =
    sidebarOpen || explorerOpen || composeOpen || shareOpen || giftsOpen || appearanceOpen || sendMemoryId != null
  const navSuppressed = surfaceUp || uiHidden
  // 모달형 표면(탐색·작성·공유·선물·보내기·변천사)이 뜨면 배경을 딤 백드롭으로 가린다.
  const modalUp = explorerOpen || composeOpen || shareOpen || giftsOpen || sendMemoryId != null || evolutionOpen
  const closeModalSurfaces = useCallback(() => {
    closeSurfaces()
    useEvolutionStore.getState().close()
  }, [closeSurfaces])

  // 단일 Esc 라우터(change 09): 위에 뜬 표면을 위에서부터 닫은 뒤(보내기→변천사→꾸미기→공유→선물→
  // 작성→탐색→사이드바), 마지막으로 포커스(별 회상·일기 조망)를 푼다. SideDrawer는 자체 Esc도 잡지만
  // (stopPropagation) 여기서도 사이드바를 닫아 일관되게 라우팅한다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isTypingTarget()) return
      if (sendMemoryId) return void setSendMemoryId(null)
      if (useEvolutionStore.getState().openFor) return void useEvolutionStore.getState().close()
      if (appearanceOpen) return void setAppearanceOpen(false)
      if (shareOpen) return void setShareOpen(false)
      if (giftsOpen) return void setGiftsOpen(false)
      if (composeOpen) return void setComposeOpen(false)
      if (explorerOpen) return void setExplorerOpen(false)
      if (sidebarOpen) return void setSidebarOpen(false)
      if (focusActor.getSnapshot().matches('idle')) return
      focusActor.send({ type: 'DISMISS' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sendMemoryId, appearanceOpen, shareOpen, giftsOpen, composeOpen, explorerOpen, sidebarOpen])

  return {
    sidebarOpen,
    setSidebarOpen,
    explorerOpen,
    setExplorerOpen,
    explorerTab,
    setExplorerTab,
    uiHidden,
    setUiHidden,
    composeOpen,
    setComposeOpen,
    shareOpen,
    setShareOpen,
    giftsOpen,
    setGiftsOpen,
    appearanceOpen,
    setAppearanceOpen,
    sendMemoryId,
    setSendMemoryId,
    demoPopover,
    setDemoPopover,
    evolutionOpen,
    closeSurfaces,
    prepareOpen,
    openSidebar,
    openExplorer,
    openCompose,
    openShare,
    openGifts,
    openAppearance,
    toggleUiHidden,
    closeModalSurfaces,
    surfaceUp,
    navSuppressed,
    modalUp,
  }
}

export type UniverseSurfaces = ReturnType<typeof useUniverseSurfaces>
