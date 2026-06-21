// 데모 둘러보기 스포트라이트 투어 overlay(plan 48·change 13). 우주 캔버스 밖 DOM 레이어다 — 3D 씬 안
// <Html>을 넣지 않는다(헌법 §8). 진행 로직(어느 phase로·언제)은 전부 tour.machine이 소유하고, 이 컴포넌트는
// 스냅샷에서 파생한 값으로 렌더하고 사용자 입력(다음/이전/건너뛰기·Esc)을 이벤트로 보내기만 한다.
// 현재 target만 남기고 나머지는 어둡게 가려(딤) 클릭을 막고, target 둘레는 별빛 테두리(glow)로 강조한다 —
// 사용자는 하이라이트된 버튼만 누른다. `다음`은 머신이 그 phase에서 NEXT를 받을 때만(=정보 phase) 보인다
// (snapshot.can('NEXT') — 행동 phase는 행동으로만 진행). 시점 전환 항해 실습(nav-practice 태그)은 딤·카드를
// 거의 투명하게 비워 우주를 보며 시점을 직접 움직이게 한다. 캔버스 안 별처럼 DOM이 없는 단계는 딤이 클릭을
// 막지 않아(별을 직접 눌러보게) 중앙 안내 카드만 띄운다.
import { useEffect, useMemo, useRef } from 'react'
import { useSelector } from '@xstate/react'
import type { ActorRefFrom } from 'xstate'
import { useCoarsePointer } from '@/shared/ui/use-coarse-pointer'
import { TOUR_STEPS, type TourBody } from '../model/steps'
import {
  tourMachine,
  selectCanNext,
  selectCanPrev,
  selectIsFinalPhase,
  selectIsNavPractice,
  selectPhase,
  selectPhaseIndex,
  selectStepIndex,
  selectTitle,
} from '../model/tour.machine'
import { useTourTarget } from './use-tour-target'

export interface DemoGuidedTourProps {
  /** 둘러보기 진행 머신 액터(change 13) — 페이지가 navSampler를 provide해 만든 모듈 싱글턴을 내려준다. */
  actor: ActorRefFrom<typeof tourMachine>
}

/** 디바이스(터치/마우스)에 맞는 문구를 고른다. */
function resolveBody(body: TourBody, coarse: boolean): string {
  return typeof body === 'string' ? body : coarse ? body.touch : body.mouse
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

export function DemoGuidedTour(props: DemoGuidedTourProps) {
  const { actor } = props
  const index = useSelector(actor, selectStepIndex)
  const phaseIndex = useSelector(actor, selectPhaseIndex)
  const phase = useSelector(actor, selectPhase)
  const title = useSelector(actor, selectTitle)
  const canNext = useSelector(actor, selectCanNext)
  const canPrev = useSelector(actor, selectCanPrev)
  const isFinal = useSelector(actor, selectIsFinalPhase)
  // 항해 실습 phase에선 target이 없으니 nav-practice 태그만으로 충분(투명 처리용).
  const navPractice = useSelector(actor, selectIsNavPractice)
  const total = TOUR_STEPS.length

  const rect = useTourTarget(phase?.target ?? null)
  const reduced = usePrefersReducedMotion()
  const coarse = useCoarsePointer()
  const nextBtnRef = useRef<HTMLButtonElement | null>(null)

  // Esc = 건너뛰기. 캡처 단계 + stopImmediatePropagation으로 HomePage 전역 Esc 라우터보다 먼저 단독 처리.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        actor.send({ type: 'EXIT' })
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [actor])

  // phase가 바뀌면 기본 동작 버튼에 포커스 — 키보드 사용자가 바로 Enter로 진행(행동 phase면 버튼이 없어 no-op).
  useEffect(() => {
    nextBtnRef.current?.focus()
  }, [index, phaseIndex])

  const motion = reduced ? '' : 'transition-all duration-300 ease-out'

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const maxH = 'calc(100dvh - 24px)'

  if (!phase) return null

  // coach card 위치 — target이 있으면 그 아래(공간 없으면 위), 항해 실습은 상단 중앙(화면 중앙·항해 버튼을
  // 가리지 않게), 그 외 target 없음은 화면 중앙.
  let cardStyle: React.CSSProperties
  if (rect) {
    const below = rect.top + rect.height / 2 < vh / 2
    const top = below ? rect.top + rect.height + GAP : undefined
    const bottom = below ? undefined : vh - rect.top + GAP
    const rawLeft = rect.left + rect.width / 2 - CARD_W / 2
    const left = Math.min(Math.max(rawLeft, 12), vw - CARD_W - 12)
    cardStyle = { position: 'fixed', top, bottom, left, width: CARD_W, maxHeight: maxH, overflowY: 'auto' }
  } else if (navPractice) {
    cardStyle = {
      position: 'fixed',
      top: 16,
      left: '50%',
      width: CARD_W,
      maxHeight: maxH,
      overflowY: 'auto',
      transform: 'translateX(-50%)',
    }
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
        // 항해 실습 구간은 딤을 거의 투명하게(bg-black/10) 비워 우주를 보며 시점을 직접 움직이게 한다.
        <div aria-hidden className={`absolute inset-0 ${navPractice ? 'bg-black/10' : 'bg-black/45'}`} />
      )}

      {/* coach card — 유일하게 입력을 받는 표면(pointer-events-auto). */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label="둘러보기 안내"
        className={`pointer-events-auto flex flex-col gap-3 rounded-2xl border border-white/12 ${navPractice ? 'bg-black/55' : 'bg-black/85'} p-4 text-left shadow-2xl backdrop-blur ${motion}`}
        style={cardStyle}
      >
        <div aria-live="polite" className="flex flex-col gap-1">
          <span className="text-[11px] tracking-wide text-white/40">
            둘러보기 {index + 1} / {total}
          </span>
          <h2 className="font-display text-lg text-white/90">{title}</h2>
          <p className="text-sm leading-relaxed text-white/60">{resolveBody(phase.body, coarse)}</p>
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
            onClick={() => actor.send({ type: 'EXIT' })}
            className="rounded-lg px-2.5 py-1.5 text-xs text-white/45 transition hover:text-white/75"
          >
            건너뛰기
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => actor.send({ type: 'PREV' })}
              disabled={!canPrev}
              className="rounded-lg px-3 py-1.5 text-sm text-white/70 transition hover:text-white disabled:cursor-not-allowed disabled:text-white/20"
            >
              이전
            </button>
            {/* `다음`은 정보 phase에서만 활성. 행동 phase에선 invisible로 자리만 지켜 `이전` 버튼이 오른쪽으로 밀리지 않게 한다(위치 고정). */}
            <button
              ref={nextBtnRef}
              type="button"
              onClick={() => actor.send({ type: 'NEXT' })}
              disabled={!canNext}
              aria-hidden={!canNext}
              tabIndex={canNext ? undefined : -1}
              className={`rounded-lg border border-white/15 bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-white/25 ${canNext ? '' : 'invisible'}`}
            >
              {isFinal ? '자유롭게 탐험하기' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
