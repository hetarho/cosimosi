// 데모 튜토리얼 스포트라이트 투어 overlay(plan 48). 우주 캔버스 밖 DOM 레이어다 — 3D 씬 안
// <Html>을 넣지 않는다(헌법 §8). 현재 target만 남기고 나머지는 어둡게 가려(딤) 클릭을 막고,
// target 둘레는 별빛처럼 빛나는 테두리(glow)로 강조한다 — 그래서 사용자는 하이라이트된 버튼만
// 누를 수 있다. 행동 안내형: 단계는 phase로 나뉘어, 사용자가 실제 버튼을 눌러 진행한다(UI 숨김
// 토글·팝오버 열림·페르소나 전환·시간 이동·사이드바/망원경 열림을 관찰). 캔버스 안 별처럼 DOM이
// 없는 단계는 딤이 클릭을 막지 않아(별을 직접 눌러보게) 중앙 안내 카드만 띄운다.
import { useEffect, useMemo, useRef, useState } from 'react'
import { TOUR_STEPS, type TourAwait } from '../model/steps'
import { useTourTarget } from './use-tour-target'

export interface DemoGuidedTourProps {
  stepIndex: number
  uiHidden: boolean
  /** 현재 열린 좌상단 데모 팝오버. */
  popover: 'persona' | 'time' | null
  /** 현재 데모 페르소나(전환 관찰용). */
  persona: string
  /** 가상 시계 경과일(시간 이동 관찰용). */
  clockDay: number
  /** 햄버거 사이드바 열림. */
  sidebarOpen: boolean
  /** 망원경 탐색 시트 열림. */
  explorerOpen: boolean
  onPrev: () => void
  onNext: () => void
  /** 건너뛰기 / 마지막 "자유롭게 탐험하기" — flow=free로 수렴한다. */
  onExit: () => void
}

interface Observed {
  uiHidden: boolean
  popover: 'persona' | 'time' | null
  persona: string
  clockDay: number
  sidebarOpen: boolean
  explorerOpen: boolean
}

function usePrefersReducedMotion(): boolean {
  return useMemo(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  )
}

const SPOT_PAD = 4 // glow 테두리·딤 구멍이 버튼에 바짝 붙도록 작은 여백(px)
const CARD_W = 320 // coach card 폭(px)
const GAP = 18 // target과 card 사이 간격(px)

// 별빛 glow — 흰 테두리 + 번지는 색 그림자. reduced-motion이 아니면 은은히 맥동한다.
const GLOW =
  '0 0 0 2px rgba(255,255,255,0.92), 0 0 12px 2px rgba(190,205,255,0.85), 0 0 26px 8px rgba(150,180,255,0.55)'

/** phase의 await가 (단계 진입 시점 baseline 대비) 현재 상태로 충족됐는지. */
function isAwaitMet(await_: TourAwait, obs: Observed, baseline: Observed): boolean {
  switch (await_) {
    case 'ui-hidden':
      return obs.uiHidden
    case 'ui-shown':
      return !obs.uiHidden
    case 'persona-open':
      return obs.popover === 'persona'
    case 'persona-changed':
      return obs.persona !== baseline.persona
    case 'time-open':
      return obs.popover === 'time'
    case 'time-moved':
      return obs.clockDay !== baseline.clockDay
    case 'sidebar-open':
      return obs.sidebarOpen
    case 'explorer-open':
      return obs.explorerOpen
    default:
      return false
  }
}

/** stepIndex로 key를 줘 단계가 바뀌면 phase·baseline을 리셋(remount)한다. */
export function DemoGuidedTour(props: DemoGuidedTourProps) {
  return <TourStepView key={props.stepIndex} {...props} />
}

function TourStepView({
  stepIndex,
  uiHidden,
  popover,
  persona,
  clockDay,
  sidebarOpen,
  explorerOpen,
  onPrev,
  onNext,
  onExit,
}: DemoGuidedTourProps) {
  const total = TOUR_STEPS.length
  const index = Math.min(Math.max(stepIndex, 0), total - 1)
  const step = TOUR_STEPS[index]
  const [phaseIndex, setPhaseIndex] = useState(0)
  const phase = step.phases[Math.min(phaseIndex, step.phases.length - 1)]
  const rect = useTourTarget(phase.target)
  const reduced = usePrefersReducedMotion()
  const isLast = index === total - 1
  const nextBtnRef = useRef<HTMLButtonElement | null>(null)

  const obs: Observed = { uiHidden, popover, persona, clockDay, sidebarOpen, explorerOpen }
  // 단계 진입 시점의 상태 — 'persona-changed'/'time-moved' 같은 변화 기준 await의 기준선(remount마다 새로).
  const baseline = useRef(obs)

  // 행동 안내: 현재 phase의 await가 충족되면 다음 phase로 진행(setState는 rAF로 미뤄 effect 동기 setState 회피).
  useEffect(() => {
    if (phase.await == null) return
    if (!isAwaitMet(phase.await, obs, baseline.current)) return
    if (phaseIndex >= step.phases.length - 1) return
    const id = requestAnimationFrame(() => setPhaseIndex((p) => Math.min(p + 1, step.phases.length - 1)))
    return () => cancelAnimationFrame(id)
    // obs는 매 렌더 새 객체라 deps에 풀어 넣는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.await, uiHidden, popover, persona, clockDay, sidebarOpen, explorerOpen, phaseIndex, step.phases.length])

  // Esc = 건너뛰기. 캡처 단계 + stopImmediatePropagation으로 HomePage 전역 Esc 라우터보다 먼저 단독 처리.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onExit()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onExit])

  // phase가 바뀌면 기본 동작 버튼에 포커스 — 키보드 사용자가 바로 Enter로 진행.
  useEffect(() => {
    nextBtnRef.current?.focus()
  }, [phaseIndex])

  const motion = reduced ? '' : 'transition-all duration-300 ease-out'

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const maxH = 'calc(100dvh - 24px)'

  // coach card 위치 — target이 있으면 그 아래(공간 없으면 위), 없으면 화면 중앙.
  let cardStyle: React.CSSProperties
  if (rect) {
    const below = rect.top + rect.height / 2 < vh / 2
    const top = below ? rect.top + rect.height + GAP : undefined
    const bottom = below ? undefined : vh - rect.top + GAP
    const rawLeft = rect.left + rect.width / 2 - CARD_W / 2
    const left = Math.min(Math.max(rawLeft, 12), vw - CARD_W - 12)
    cardStyle = { position: 'fixed', top, bottom, left, width: CARD_W, maxHeight: maxH, overflowY: 'auto' }
  } else {
    cardStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      width: CARD_W,
      maxHeight: maxH,
      overflowY: 'auto',
      transform: 'translate(-50%, -50%)',
    }
  }

  // 구멍(hole) 좌표 — target rect + 여백. 이 영역만 클릭이 통과한다.
  const hx = rect ? rect.left - SPOT_PAD : 0
  const hy = rect ? rect.top - SPOT_PAD : 0
  const hw = rect ? rect.width + SPOT_PAD * 2 : 0
  const hh = rect ? rect.height + SPOT_PAD * 2 : 0
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {rect ? (
        <>
          {/* 클릭 차단 — 구멍 밖을 덮는 투명 패널 4개(pointer-events-auto). 시각 딤은 아래 box-shadow가
              담당하고, 이 패널들은 보이지 않게 바깥 클릭만 막는다(하이라이트된 버튼만 누를 수 있음).
              시각 딤과 한 프레임 어긋나지 않게 transition 없이 최종 구멍 위치로 스냅한다. */}
          <div className="pointer-events-auto absolute" style={{ top: 0, left: 0, width: vw, height: Math.max(0, hy) }} />
          <div className="pointer-events-auto absolute" style={{ top: hy + hh, left: 0, width: vw, height: Math.max(0, vh - (hy + hh)) }} />
          <div className="pointer-events-auto absolute" style={{ top: hy, left: 0, width: Math.max(0, hx), height: hh }} />
          <div className="pointer-events-auto absolute" style={{ top: hy, left: hx + hw, width: Math.max(0, vw - (hx + hw)), height: hh }} />
          {/* 둥근 구멍 딤 — box-shadow 큰 spread가 구멍만 남기고 어둡힌다(rounded로 glow와 같은 부드러운 모서리). */}
          <div
            aria-hidden
            className={`absolute rounded-xl ${motion}`}
            style={{ top: hy, left: hx, width: hw, height: hh, boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)' }}
          />
          {/* 별빛 glow 테두리 — 같은 둥근 구멍 둘레를 빛나듯 강조(은은히 맥동, 클릭은 통과). */}
          <div
            aria-hidden
            className={`absolute rounded-xl ${reduced ? '' : 'animate-pulse'} ${motion}`}
            style={{ top: hy, left: hx, width: hw, height: hh, boxShadow: GLOW }}
          />
        </>
      ) : (
        // target이 없는 단계(인사·별 클릭)는 딤이 클릭을 막지 않는다 — 캔버스의 별을 직접 눌러볼 수 있게.
        <div aria-hidden className="absolute inset-0 bg-black/45" />
      )}

      {/* coach card — 유일하게 입력을 받는 표면(pointer-events-auto). */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label="둘러보기 안내"
        className={`pointer-events-auto flex flex-col gap-3 rounded-2xl border border-white/12 bg-black/85 p-4 text-left shadow-2xl backdrop-blur ${motion}`}
        style={cardStyle}
      >
        <div aria-live="polite" className="flex flex-col gap-1">
          <span className="text-[11px] tracking-wide text-white/40">
            둘러보기 {index + 1} / {total}
          </span>
          <h2 className="font-display text-lg text-white/90">{step.title}</h2>
          <p className="text-sm leading-relaxed text-white/60">{phase.body}</p>
        </div>

        <div className="flex flex-wrap gap-1.5" aria-hidden>
          {TOUR_STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-white/80' : 'w-1.5 bg-white/25'}`}
            />
          ))}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onExit}
            className="rounded-lg px-2.5 py-1.5 text-xs text-white/45 transition hover:text-white/75"
          >
            건너뛰기
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={index === 0}
              className="rounded-lg px-3 py-1.5 text-sm text-white/70 transition hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
            >
              이전
            </button>
            <button
              ref={nextBtnRef}
              type="button"
              onClick={isLast ? onExit : onNext}
              className="rounded-lg border border-white/15 bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-white/25"
            >
              {isLast ? '자유롭게 탐험하기' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
