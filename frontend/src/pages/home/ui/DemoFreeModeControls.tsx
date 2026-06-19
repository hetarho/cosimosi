// 데모 자유모드 좌상단 컨트롤(plan 47) — change09 테마 버튼 아래에 페르소나·시간 아이콘 버튼을
// 세로로 둔다. 각 버튼은 작은 transient 팝오버를 연다(바텀시트 아님). 한 번에 하나만 열리고,
// 다른 우주 표면(사이드바·망원경·회상)이 열리면 페이지가 닫는다(controlled — open/onOpen).
// 페이지(HomePage)가 페르소나/시간 액션을 소유하고 콜백으로 내려준다(FSD — widget 직접 호출 없음).
import type { ReactNode } from 'react'
import { Clock3, UserRound } from 'lucide-react'
import type { DemoPersona } from '@/shared/lib/demo'
import type { DemoPersonaMeta } from '@/shared/lib/demo'

export type DemoPopover = 'persona' | 'time' | null

export interface DemoFreeModeControlsProps {
  /** 현재 열린 데모 팝오버(없으면 null) — 페이지가 소유해 다른 표면과 배타로 만든다. */
  open: DemoPopover
  /** 같은 버튼을 다시 누르면 닫고(toggle), 다른 버튼이면 그쪽으로 전환한다. */
  onOpen: (which: DemoPopover) => void
  persona: DemoPersona
  personaList: DemoPersonaMeta[]
  /** 페르소나 선택 → 그 우주로 전환(가상 시계·추가 별 초기화, 자유모드 유지). */
  onSelectPersona: (id: DemoPersona) => void
  /** 하루/한 달 후로 이동(기존 하루 단위 배치). */
  onSkipDays: (days: number) => void
  /** 처음으로 — 현재 페르소나·자유모드 유지, 가상 시계 0·추가 별 0. */
  onResetToStart: () => void
}

const iconBtnCls =
  'grid size-9 place-items-center rounded-md bg-white/10 text-white/80 backdrop-blur transition hover:bg-white/20 aria-expanded:bg-white/25 aria-expanded:text-white'
const popoverCls =
  'absolute left-11 top-0 z-30 w-56 rounded-xl border border-white/10 bg-black/70 p-1.5 text-sm shadow-xl backdrop-blur'
const rowCls =
  'w-full rounded-lg px-3 py-2 text-left text-white/80 transition hover:bg-white/10 hover:text-white'

/** 아이콘 트리거 버튼 + 그 옆에 뜨는 작은 메뉴 팝오버 한 쌍 — 페르소나/시간(이후 추가될 컨트롤도)
 *  같은 토글·aria·레이아웃을 공유한다(접근성 변경을 한 곳에서). */
function PopoverButton({
  icon,
  label,
  tourId,
  popoverTourId,
  expanded,
  onToggle,
  children,
}: {
  icon: ReactNode
  label: string
  /** plan 48 스포트라이트 투어가 이 버튼을 찾는 `data-tour-id`. */
  tourId: string
  /** 투어가 열린 팝오버를 하이라이트할 `data-tour-id`(버튼을 누른 뒤 그 위로 옮겨감). */
  popoverTourId: string
  expanded: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        data-tour-id={tourId}
        aria-haspopup="menu"
        aria-expanded={expanded}
        aria-label={label}
        title={label}
        className={iconBtnCls}
      >
        {icon}
      </button>
      {expanded && (
        <div role="menu" aria-label={label} data-tour-id={popoverTourId} className={popoverCls}>
          {children}
        </div>
      )}
    </div>
  )
}

export function DemoFreeModeControls({
  open,
  onOpen,
  persona,
  personaList,
  onSelectPersona,
  onSkipDays,
  onResetToStart,
}: DemoFreeModeControlsProps) {
  return (
    <div className="absolute left-4 top-[calc(1rem+env(safe-area-inset-top)+2.75rem)] z-20 flex flex-col items-start gap-2">
      <PopoverButton
        icon={<UserRound className="size-5" aria-hidden />}
        label="페르소나 — 누구의 우주를 볼지"
        tourId="persona"
        popoverTourId="persona-popover"
        expanded={open === 'persona'}
        onToggle={() => onOpen(open === 'persona' ? null : 'persona')}
      >
        {personaList.map((p) => {
          const active = p.id === persona
          return (
            <button
              key={p.id}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => onSelectPersona(p.id)}
              className={`${rowCls} ${active ? 'bg-white/15 text-white' : ''}`}
            >
              <span className="block font-medium">{p.label}</span>
              <span className="block text-xs text-white/45">{p.tagline}</span>
            </button>
          )
        })}
      </PopoverButton>

      <PopoverButton
        icon={<Clock3 className="size-5" aria-hidden />}
        label="시간 — 가상 시계 이동"
        tourId="time"
        popoverTourId="time-popover"
        expanded={open === 'time'}
        onToggle={() => onOpen(open === 'time' ? null : 'time')}
      >
        <button type="button" role="menuitem" onClick={() => onSkipDays(1)} className={rowCls}>
          하루 후로 이동
        </button>
        <button
          type="button"
          role="menuitem"
          data-tour-id="time-skip-month"
          onClick={() => onSkipDays(30)}
          className={rowCls}
        >
          한 달 후로 이동
        </button>
        <button type="button" role="menuitem" onClick={onResetToStart} className={rowCls}>
          처음으로
        </button>
      </PopoverButton>
    </div>
  )
}
