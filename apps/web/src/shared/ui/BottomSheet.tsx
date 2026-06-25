import { useRef, useState, type ReactNode } from 'react'
import { motion, useDragControls, useReducedMotion } from 'motion/react'

export interface BottomSheetProps {
  /** Header title shown above the scrollable body. */
  title: string
  /** Dismiss the sheet entirely. */
  onClose: () => void
  children: ReactNode
}

/**
 * Mobile (coarse pointer) overlay over the persistent universe canvas (spec 31, acceptance
 * 1.1/1.4) — a bottom sheet that snaps between `half` and `full` and drags down to dismiss.
 * NON-blocking: no backdrop, so the universe stays visible AND interactive behind it (1.3).
 * Canvas-outside DOM only (헌법8 — no `<Html>` in the 3D scene). `prefers-reduced-motion`
 * drops BOTH the slide/spring AND the max-height transition to instant (1.7). Higher-level
 * hosts decide when it is open; this renders only the expanded sheet.
 *
 * Drag is started ONLY from the grab handle (useDragControls + dragListener={false}) so a
 * vertical swipe in the scrollable list scrolls the list natively instead of dragging/dismissing
 * the sheet.
 */
export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  const reduce = useReducedMotion()
  const dragControls = useDragControls()
  // 스냅: half(우주를 더 보임)·full(목록을 더 보임). 핸들을 끌어 오가고, half에서 더 끌어내리면 닫힌다.
  const [snap, setSnap] = useState<'half' | 'full'>('half')
  // 방금 드래그했는지 — 드래그 끝 직후의 합성 click이 snap을 되돌리지 않게(고속 짧은 플릭에서
  // onDragEnd 스냅 + 뒤따르는 click 토글이 겹치는 것 방지). onDragStart에서 켜고 click에서 소비.
  const didDrag = useRef(false)

  return (
    <motion.section
      role="dialog"
      aria-modal="false"
      aria-label={title}
      className={`absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-2xl border border-white/10 bg-black/70 backdrop-blur ${reduce ? '' : 'transition-[max-height] duration-300 ease-out'}`}
      style={{ maxHeight: snap === 'full' ? '88dvh' : '56dvh' }}
      initial={reduce ? false : { y: '100%' }}
      animate={{ y: 0 }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 36 }}
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.04, bottom: 0.5 }}
      onDragStart={() => {
        didDrag.current = true
      }}
      onDragEnd={(_, info) => {
        // 아래로 충분히 끌면: full→half로 한 단계, half면 닫기. 위로 끌면 full로 펼친다.
        if (info.offset.y > 120 || info.velocity.y > 800) {
          if (snap === 'full') setSnap('half')
          else onClose()
        } else if (info.offset.y < -80 || info.velocity.y < -800) {
          setSnap('full')
        }
      }}
    >
      {/* 드래그 핸들(grab bar) — 여기서만 드래그를 시작한다(리스트 스크롤과 분리). 탭하면 half↔full 토글.
          탭 타깃을 충분히 키우려 strip 전체(full-width·~30px)를 핸들로 두고, 보이는 그랩바는 내부 span. */}
      <button
        type="button"
        aria-label={snap === 'full' ? '시트 줄이기' : '시트 펼치기'}
        onPointerDown={(e) => dragControls.start(e)}
        onClick={() => {
          if (didDrag.current) {
            didDrag.current = false // 방금 드래그였으면 토글 생략(스냅은 onDragEnd가 이미 결정)
            return
          }
          setSnap((s) => (s === 'full' ? 'half' : 'full'))
        }}
        className="flex w-full shrink-0 cursor-grab touch-none justify-center pt-3 pb-2 active:cursor-grabbing"
      >
        <span className="h-1.5 w-10 rounded-full bg-white/30" />
      </button>
      <header className="flex shrink-0 items-center justify-between px-4 pt-1 pb-2">
        <h2 className="text-sm font-medium text-white/80">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="rounded-md px-2 text-white/50 transition hover:text-white/90"
        >
          ✕
        </button>
      </header>
      {/* min-h-0 + overflow so a long body (recall/share/…) scrolls inside the sheet; a content
          list with its own flex-1 overflow nests safely. pb: safe-area로 마지막 항목·스크롤 끝이
          홈 인디케이터/제스처 바에 가리지 않게. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
    </motion.section>
  )
}
