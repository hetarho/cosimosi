// 데모 시뮬레이션 HUD(spec 19) — 캔버스 밖 2D DOM(헌법 §4), 데모에서만 마운트.
// 두 모달로 분리한다(사용자 피드백): ① "기억 실험실" 컨트롤러 패널(시간 머신·별 띄우기),
// ② "뇌과학 이론" 안내 모달 — 이론을 한 화면에 나열하지 않고 **한 번에 하나씩**,
// 탭(점)·‹›버튼·방향키·스와이프로 넘기는 페이지네이션. 이론↔컨트롤 1:1 버튼은 없고
// 각 이론은 미니 비주얼(entities/theory — 랜딩과 같은 시각 언어) + howTo(어떤 컨트롤러로
// 어떤 행위)만 안내한다. 랜딩 카드의 `?sim=<id>` 진입은 그 이론 페이지로 열린 채 시작한다.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Mood } from '@/shared/api'
import { demoAddMultiSceneStar, demoAddStar, demoOffsetDays, demoToday } from '@/shared/lib/demo'
import { universeInvalidateKey } from '@/entities/memory'
import { THEORIES, TheoryDemo } from '@/entities/theory'
import { resetDemoExperience, runTimeSkip } from '../model/time-travel'

export interface DemoSimPanelProps {
  /** `/universe?sim=<id>` 진입 포커스 — 이론 모달을 그 이론 페이지로 연다(없는 id는 무시). */
  initialSimId?: string
}

// 데모의 "별 띄우기" 컨트롤러가 기록 폼을 대신한다. 기록 폼은 13종(spec 29)이지만
// 데모는 미리 쓴 일기 본문(QUICK_ENTRIES)이 있는 기존 7종만 노출한다.
const MOODS: { value: Mood; label: string }[] = [
  { value: Mood.JOY, label: '기쁨' },
  { value: Mood.CALM, label: '평온' },
  { value: Mood.SAD, label: '슬픔' },
  { value: Mood.ANGER, label: '분노' },
  { value: Mood.FEAR, label: '두려움' },
  { value: Mood.LOVE, label: '사랑' },
  { value: Mood.NEUTRAL, label: '중립' },
]

const SWIPE_PX = 40 // 이 이상 가로로 끌면 페이지 넘김(터치/마우스 공통)

const chipBtn =
  'rounded-md bg-white/10 px-2.5 py-1.5 text-xs text-white/80 backdrop-blur transition hover:bg-white/20'
const entryChip =
  'rounded-full border px-3 py-1.5 text-xs backdrop-blur transition'
const inputCls =
  'rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/90 outline-none focus:border-white/30'

/** 컨트롤러 패널 — 시간 머신 + 별 띄우기(감정·날짜 드롭다운, 본문은 미리 쓴 일기). */
function ControlsPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [elapsed, setElapsed] = useState(demoOffsetDays)
  const [mood, setMood] = useState<Mood>(Mood.JOY)
  const [date, setDate] = useState(demoToday)

  const skip = (days: number) => {
    runTimeSkip(queryClient, days)
    // 스킵은 ~0.9s 트윈으로 흐르므로(time-travel) 시계를 읽지 않고 목표 경과일을 바로 표시.
    setElapsed((e) => e + days)
  }
  const restart = () => {
    resetDemoExperience()
    setElapsed(0)
    setDate(demoToday())
  }
  // "별 띄우기": 고른 감정·날짜로 별 생성(본문은 그 감정의 미리 쓴 일기 중 무작위) —
  // refetch가 별을 실어 오면 탄생 애니메이션(StarField)이 등장을 보여준다.
  const spawnStar = () => {
    demoAddStar(mood, date)
    void queryClient.invalidateQueries({ queryKey: universeInvalidateKey() })
  }
  // "다감정 하루 띄우기"(spec 21): 여러 감정이 담긴 일기 한 편 → 색이 다른 N개 조각
  // 별이 강한 일내(intra_entry) 선으로 묶여 태어난다(기억 분할 체험).
  const spawnMultiScene = () => {
    demoAddMultiSceneStar(date)
    void queryClient.invalidateQueries({ queryKey: universeInvalidateKey() })
  }

  return (
    <section
      aria-label="기억 실험실 컨트롤러"
      className="absolute inset-x-2 bottom-2 z-30 flex max-h-[70dvh] flex-col gap-3 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-black/60 p-4 backdrop-blur sm:inset-x-auto sm:bottom-14 sm:left-4 sm:z-20 sm:max-h-[55dvh] sm:w-80"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-white/85">🧪 기억 실험실</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="접기"
          className="rounded-md px-2 text-white/50 transition hover:text-white/90"
        >
          ✕
        </button>
      </header>

      {/* 컨트롤러 1 — 시간 머신: 실제 감쇠 수식이 그대로 도는 시간 전진(연출 아님). */}
      <div className="flex flex-col gap-2 rounded-lg border border-indigo-300/20 bg-indigo-500/10 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-indigo-100/90">⏩ 시간 머신</span>
          <span className="text-xs text-indigo-200/70">
            {elapsed > 0 ? `가상 +${elapsed}일째` : '현재'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => skip(1)} className={chipBtn}>
            하루 지나기
          </button>
          <button type="button" onClick={() => skip(30)} className={chipBtn}>
            한 달 지나기
          </button>
          <button
            type="button"
            onClick={restart}
            className="rounded-md px-2 py-1.5 text-xs text-white/45 transition hover:text-white/80"
          >
            처음으로
          </button>
        </div>
      </div>

      {/* 컨트롤러 2 — 별 띄우기: 감정·날짜만 고르면 미리 쓴 일기로 별이 태어난다. */}
      <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
        <span className="text-xs font-medium text-white/85">✦ 별 띄우기</span>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[11px] text-white/50">
            감정
            <select
              className={inputCls}
              value={String(mood)}
              onChange={(e) => setMood(Number(e.target.value) as Mood)}
            >
              {MOODS.map((m) => (
                <option key={m.value} value={String(m.value)}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-white/50">
            날짜
            <input
              type="date"
              className={inputCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <button type="button" onClick={spawnStar} className={chipBtn}>
          이 감정으로 별 띄우기
        </button>
        <button type="button" onClick={spawnMultiScene} className={chipBtn}>
          ✨ 다감정 하루 띄우기 — 일기 1편 → 별 여럿
        </button>
        <p className="text-[11px] leading-relaxed text-white/40">
          내용은 미리 써 둔 일기에서 골라요 — 같은 날·비슷한 감정의 기억과 이어지고,
          여러 감정이 담긴 하루는 장면마다 조각 별로 갈라져요.
        </p>
      </div>

      <p className="text-[11px] text-white/35">체험 전용 시뮬레이션 — 새로고침하면 초기화돼요.</p>
    </section>
  )
}

/** 이론 안내 모달 — 고정 크기 캐러셀. 슬라이드에 랜딩 카드의 인터랙션 원본(TheoryDemo,
 *  entities/theory)을 그대로 싣고, 좌우 드래그(터치·마우스)·점 탭·‹›·방향키로 넘긴다. */
function TheoryModal({ initialPage, onClose }: { initialPage: number; onClose: () => void }) {
  const [page, setPage] = useState(initialPage)
  const total = THEORIES.length
  const go = (d: number) => setPage((p) => Math.min(total - 1, Math.max(0, p + d)))

  // 방향키 내비게이션: 모달에 포커스를 줘서 키 입력을 받는다(Esc 닫기 포함).
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  // 좌우 드래그 캐러셀: 트랙을 손가락/커서에 1:1로 끌다가 놓으면 가까운 페이지로 스냅.
  // 슬라이드 안의 슬라이더·버튼 위에서 시작한 드래그는 그 컨트롤 몫으로 남긴다.
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; width: number } | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const dragStart = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('input,button,select,textarea,a')) return
    dragRef.current = { startX: e.clientX, width: trackRef.current?.clientWidth ?? 1 }
    setDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const dragMove = (e: ReactPointerEvent) => {
    if (dragRef.current) setDragX(e.clientX - dragRef.current.startX)
  }
  const dragEnd = () => {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    setDragging(false)
    setDragX(0)
    if (Math.abs(dragX) > Math.max(SWIPE_PX, d.width * 0.18)) go(dragX < 0 ? 1 : -1)
  }

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="뇌과학 이론 안내"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(-1)
          else if (e.key === 'ArrowRight') go(1)
          else if (e.key === 'Escape') onClose()
        }}
        className="flex h-[min(85dvh,640px)] w-full max-w-xl flex-col gap-3 rounded-xl border border-white/10 bg-black/80 p-5 outline-none backdrop-blur"
      >
        <header className="flex shrink-0 items-center justify-between">
          <h2 className="text-sm font-medium text-white/85">
            ❕ 뇌과학 이론{' '}
            <span className="text-xs text-white/40">
              {page + 1} / {total}
            </span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md px-2 text-white/50 transition hover:text-white/90"
          >
            ✕
          </button>
        </header>

        {/* 캐러셀 트랙 — touch-pan-y: 세로 스크롤은 슬라이드에, 가로 제스처는 드래그에. */}
        <div
          ref={trackRef}
          className="min-h-0 flex-1 touch-pan-y overflow-hidden"
          onPointerDown={dragStart}
          onPointerMove={dragMove}
          onPointerUp={dragEnd}
          onPointerCancel={dragEnd}
        >
          <div
            className="flex h-full"
            style={{
              transform: `translateX(calc(${-page * 100}% + ${dragX}px))`,
              transition: dragging ? 'none' : 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {THEORIES.map((entry) => (
              <div
                key={entry.id}
                className="h-full w-full shrink-0 overflow-y-auto overscroll-contain pr-1"
                aria-hidden={entry !== THEORIES[page]}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white/90">{entry.title}</span>
                    {entry.status === 'planned' && (
                      <span className="shrink-0 rounded-full border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[10px] text-amber-200/90">
                        🚧 준비 중
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-white/60">{entry.oneLine}</p>
                  {/* 랜딩 카드의 인터랙션 원본(entities/theory) — 직접 만져 볼 수 있다. */}
                  <TheoryDemo id={entry.id} />
                  <p className="text-xs leading-relaxed text-indigo-200/85">{entry.howTo}</p>
                  {entry.doi && (
                    <a
                      href={entry.doi}
                      target="_blank"
                      rel="noreferrer"
                      className="w-fit text-[10px] text-white/35 underline-offset-2 transition hover:text-white/60 hover:underline"
                    >
                      근거 논문
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 페이지네이션: ‹ 점 탭 › — 드래그·방향키와 같은 이동. */}
        <div className="flex shrink-0 items-center justify-between">
          <button type="button" onClick={() => go(-1)} aria-label="이전 이론" className={chipBtn} disabled={page === 0}>
            ‹
          </button>
          <div className="flex items-center gap-1.5" role="tablist" aria-label="이론 선택">
            {THEORIES.map((e, i) => (
              <button
                key={e.id}
                type="button"
                role="tab"
                aria-selected={i === page}
                aria-label={e.title}
                onClick={() => setPage(i)}
                className={`size-2 rounded-full transition ${
                  i === page ? 'bg-indigo-300' : 'bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
          <button type="button" onClick={() => go(1)} aria-label="다음 이론" className={chipBtn} disabled={page === total - 1}>
            ›
          </button>
        </div>
      </div>
    </div>
  )
}

export function DemoSimPanel({ initialSimId }: DemoSimPanelProps) {
  const focusedIdx = THEORIES.findIndex((e) => e.id === initialSimId)
  // 데스크톱은 컨트롤러를 펼친 채, 모바일은 칩으로 접어 시작(우주를 가리지 않게).
  const [controlsOpen, setControlsOpen] = useState(
    () => window.matchMedia('(min-width: 640px)').matches,
  )
  // ?sim= 진입(랜딩 "이 카드 체험하기")은 그 이론 페이지가 떠 있는 채로 시작한다.
  const [theoryOpen, setTheoryOpen] = useState(focusedIdx >= 0)
  const elapsed = demoOffsetDays()

  return (
    <>
      {/* 진입 칩 — 컨트롤러와 이론 안내는 서로 다른 모달. (데모에선 작성 폼/트리거가 없어
          모바일에서도 좌하단이 비어 있다.) */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setControlsOpen((v) => !v)}
          aria-expanded={controlsOpen}
          className={`${entryChip} ${
            controlsOpen
              ? 'border-indigo-300/40 bg-indigo-500/30 text-indigo-50'
              : 'border-indigo-300/30 bg-indigo-500/20 text-indigo-100/90 hover:bg-indigo-500/30'
          }`}
        >
          🧪 기억 실험실{elapsed > 0 ? ` · +${elapsed}일` : ''}
        </button>
        <button
          type="button"
          onClick={() => setTheoryOpen(true)}
          className={`${entryChip} border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90`}
        >
          ❕ 뇌과학 이론
        </button>
      </div>

      {controlsOpen && <ControlsPanel onClose={() => setControlsOpen(false)} />}
      {theoryOpen && (
        <TheoryModal
          initialPage={Math.max(0, focusedIdx)}
          onClose={() => setTheoryOpen(false)}
        />
      )}
    </>
  )
}
