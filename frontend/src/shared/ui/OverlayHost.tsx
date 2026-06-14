import { useEffect, type ReactNode } from 'react'
import { Backdrop } from './Backdrop'
import { BottomSheet } from './BottomSheet'
import { SidePanel } from './SidePanel'
import { useCoarsePointer } from './use-coarse-pointer'

export interface OverlayHostProps {
  /** Whether the overlay is mounted/visible. */
  open: boolean
  /** Collapsed to a handle after an item was chosen (the universe flies to it behind it). */
  peek: boolean
  /** Header title (expanded) — also the dialog's accessible name. */
  title: string
  /** Label on the peek handle (e.g. "📖 일기 목록 펼치기"). */
  peekLabel: string
  /** Dismiss the overlay entirely. */
  onClose: () => void
  /** Restore peek → expanded. */
  onExpand: () => void
  /** Custom peek content (replaces the default handle pill) — e.g. a selected-item card. */
  peekSlot?: ReactNode
  /** The panel content (list/search) — the chrome (header/handle/snap) is the host's job. */
  children: ReactNode
}

/**
 * Responsive overlay host (spec 31) — the single shell for list/explore overlays that float
 * OVER the persistent universe canvas (concept §우주 탐험: "전환은 별개 화면이 아니라 같은 우주의
 * 다른 시점… 언제나 우주 안에 머무는 느낌"). Coarse pointer → BottomSheet, fine → SidePanel
 * (헌법4 — 플랫폼 분기는 ui 레이어). NON-blocking: no backdrop, so the universe stays visible
 * and interactive behind it (1.3); a blocking dim is reserved for confirm modals only. Esc
 * closes (no focus trap — the canvas behind must stay reachable). Each spec provides only the
 * CONTENT (`…Sheet`); this host owns the container, the peek handle, snap, and reduced-motion.
 */
export function OverlayHost({
  open,
  peek,
  title,
  peekLabel,
  onClose,
  onExpand,
  peekSlot,
  children,
}: OverlayHostProps) {
  const coarse = useCoarsePointer()

  // Esc closes (non-blocking — no focus trap, so the universe behind stays reachable).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  // peek: 항목을 고른 뒤 잦아든 상태 — 별을 가리지 않으면서 돌아갈 길을 남긴다(1.2). 콘텐츠 측이
  // peekSlot(선택 항목 카드 등)을 주면 그것을, 아니면 기본 손잡이 pill(좌하단)을 그린다. 이때
  // 배경 딤은 페이지의 포커스 딤(pointer-events-none + 캔버스 onPointerMissed 해제)이 맡는다 —
  // 여기선 별 탭(회상)을 막지 않도록 차단 backdrop을 두지 않는다.
  if (peek) {
    if (peekSlot) return <>{peekSlot}</>
    return (
      <div className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 z-30 flex items-center gap-1 rounded-full border border-white/10 bg-black/55 pl-3 backdrop-blur">
        <button
          type="button"
          onClick={onExpand}
          className="py-2.5 text-sm text-white/80 transition hover:text-white"
        >
          {peekLabel}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="px-2.5 py-2.5 text-white/45 transition hover:text-white/90"
        >
          ✕
        </button>
      </div>
    )
  }

  // 목록 펼침: 은은한 딤 backdrop을 뒤에 깔고(배경 탭하면 닫힘) 그 위에 시트/패널. 목록 탐색 중엔
  // 우주가 포커스가 아니므로 backdrop이 탭을 받아 닫는다(메뉴 바깥 탭=닫기).
  return (
    <>
      <Backdrop onDismiss={onClose} className="z-20" />
      {coarse ? (
        <BottomSheet title={title} onClose={onClose}>
          {children}
        </BottomSheet>
      ) : (
        <SidePanel title={title} onClose={onClose}>
          {children}
        </SidePanel>
      )}
    </>
  )
}
