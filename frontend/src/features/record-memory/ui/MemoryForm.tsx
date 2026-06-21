// Compose form (spec 10, reshaped by 21 + the review step) — a 2D HUD, rendered
// OUTSIDE the R3F canvas (no DOM in the scene, Architecture §3.1). Two phases:
//   compose: 본문 + 날짜 → "별로 분해" (SegmentMemory 동기 미리보기, 저장 없음)
//   review:  AI가 나눈 조각·감정을 확인/수정/추가/삭제 → "별 띄우기" (확정 제출)
// The AI's split is therefore never persisted unseen — a wrong segmentation is
// fixed (or discarded) here before any star exists. 상태는 compose 머신(spec 39 P3,
// 모듈 싱글턴 composeActor) — useSelector로 읽고 send로 의도를 보낸다.
import { useSelector } from '@xstate/react'
import { Mood } from '@/shared/api'
import { moodFromProto } from '@/entities/memory'
import { useAppearance } from '@/entities/appearance'
import { Dropdown } from '@/shared/ui'
import { MOOD_AFFECT, MOODS_BY_QUADRANT, moodLabel, resolveMoodRgb } from '@/shared/config'
import { MAX_FRAGMENTS, type DraftFragment } from '../api/record-memory'
import {
  composeActor,
  selectBody,
  selectEntryDate,
  selectErrorText,
  selectFragments,
  selectIsSegmenting,
  selectIsSubmitting,
  selectPhase,
} from '../model/compose.machine'

const MOOD_OPTIONS = MOODS_BY_QUADRANT.map((m) => Mood[m.toUpperCase() as keyof typeof Mood])

const inputCls =
  'rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30'

/** mood → CSS color (사용자 감정색 오버라이드 반영, spec 30) — 조각 카드의 별색 점. */
function moodCss(mood: Mood, overrides?: Record<string, string>): string {
  const [r, g, b] = resolveMoodRgb(moodFromProto(mood), overrides)
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`
}

/** 검토 단계의 조각 한 장: 별색 점 + 감정 선택 + 강도 + 본문 + 삭제.
 *  disabled = 제출 중 — 제출은 클릭 시점의 스냅샷을 보내므로, 그동안의 편집이
 *  성공 reset에 조용히 증발하지 않게 입력을 잠근다. */
function FragmentCard({ fragment, disabled }: { fragment: DraftFragment; disabled: boolean }) {
  const emotionColors = useAppearance((s) => s.emotionColors)
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5">
      <div className="flex items-center gap-2">
        {/* 커스텀 다크 드롭다운(shared/ui) — 네이티브 select의 흰 OS 목록 대신. 감정 색 점 포함. */}
        <Dropdown
          ariaLabel="조각 감정"
          className="flex-1"
          value={fragment.mood}
          disabled={disabled}
          // 감정을 바꾸면 valence도 새 감정의 circumplex 근사값(MOOD_AFFECT)으로 함께 갱신해 별의
          // 물리(감쇠 λ_eff)·색이 어긋나지 않게 한다. 강도는 슬라이더로 다듬는 값이라 보존.
          onChange={(mood) =>
            composeActor.send({
              type: 'UPDATE_FRAGMENT',
              id: fragment.id,
              patch: { mood, valence: MOOD_AFFECT[moodFromProto(mood)].valence },
            })
          }
          options={MOOD_OPTIONS.map((m) => ({
            value: m,
            label: moodLabel(moodFromProto(m)),
            color: moodCss(m, emotionColors),
          }))}
        />
        <label className="flex flex-1 items-center gap-1.5 text-[10px] text-white/45">
          강도
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            className="min-w-0 flex-1"
            value={fragment.intensity}
            disabled={disabled}
            onChange={(e) =>
              composeActor.send({ type: 'UPDATE_FRAGMENT', id: fragment.id, patch: { intensity: Number(e.target.value) } })
            }
          />
        </label>
        <button
          type="button"
          aria-label="조각 삭제"
          disabled={disabled}
          onClick={() => composeActor.send({ type: 'REMOVE_FRAGMENT', id: fragment.id })}
          className="shrink-0 rounded-md px-1.5 text-white/40 transition hover:text-red-300 disabled:opacity-40"
        >
          ✕
        </button>
      </div>
      <textarea
        aria-label="조각 내용"
        className={`${inputCls} ph-no-capture h-14 resize-none text-xs`}
        placeholder="이 조각의 장면을 적어 주세요…"
        value={fragment.text}
        disabled={disabled}
        onChange={(e) => composeActor.send({ type: 'UPDATE_FRAGMENT', id: fragment.id, patch: { text: e.target.value } })}
      />
    </li>
  )
}

export function MemoryForm() {
  const phase = useSelector(composeActor, selectPhase)
  const body = useSelector(composeActor, selectBody)
  const entryDate = useSelector(composeActor, selectEntryDate)
  const fragments = useSelector(composeActor, selectFragments)
  const errorText = useSelector(composeActor, selectErrorText)
  const segmenting = useSelector(composeActor, selectIsSegmenting)
  const submitting = useSelector(composeActor, selectIsSubmitting)

  // Body-only (home-ia revamp): the page hosts this inside a Surface (title reflects the phase),
  // so the form drops its own card chrome and phase headings.
  return (
    <form
      className="flex w-full flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        composeActor.send({ type: phase === 'compose' ? 'SEGMENT' : 'SUBMIT' })
      }}
    >
      {phase === 'compose' ? (
        <>
          {/* ph-no-capture: 일기 본문 입력 — PostHog autocapture가 이 요소를 아예 건드리지
              않게 한다(스펙 18 프라이버시 헌법 3; mask_all_text 위의 이중 가드).
              분해 중에는 잠근다 — 분해는 클릭 시점의 본문 스냅샷으로 돌아가므로, 그동안
              덧붙인 문장은 조각이 되지 못한 채 기록 원본에만 남는 어긋남이 생긴다. */}
          <textarea
            className={`${inputCls} ph-no-capture h-24 resize-none`}
            placeholder="오늘의 기억을 적어보세요…"
            value={body}
            disabled={segmenting}
            onChange={(e) => composeActor.send({ type: 'SET_BODY', body: e.target.value })}
          />
          <label className="flex flex-col gap-1 text-xs text-white/50">
            시점
            <input
              type="date"
              className={inputCls}
              value={entryDate}
              disabled={segmenting}
              onChange={(e) => composeActor.send({ type: 'SET_DATE', date: e.target.value })}
            />
          </label>

          {segmenting && (
            <p className="rounded-md bg-indigo-500/10 px-2 py-1 text-xs text-indigo-200/90">
              기억을 조각내는 중… 장면마다 별이 될 조각으로 나눠요.
            </p>
          )}
          {errorText && (
            <p className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">⚠ {errorText}</p>
          )}
          <button
            type="submit"
            disabled={segmenting}
            className="rounded-md bg-indigo-500/80 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {segmenting ? '조각내는 중…' : '별로 분해'}
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-white/45">
            감정과 내용을 다듬고, 필요하면 조각을 추가하거나 지운 뒤 별을 띄워 주세요.
          </p>
          <ul className="flex max-h-60 flex-col gap-2 overflow-y-auto overscroll-contain">
            {fragments.map((f) => (
              <FragmentCard key={f.id} fragment={f} disabled={submitting} />
            ))}
          </ul>
          <button
            type="button"
            onClick={() => composeActor.send({ type: 'ADD_FRAGMENT' })}
            disabled={submitting || fragments.length >= MAX_FRAGMENTS}
            className="rounded-md border border-dashed border-white/20 px-3 py-1.5 text-xs text-white/60 transition hover:border-white/40 hover:text-white/90 disabled:opacity-40"
          >
            ＋ 조각 추가{fragments.length >= MAX_FRAGMENTS ? ` (최대 ${MAX_FRAGMENTS}개)` : ''}
          </button>

          {errorText && (
            <p className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">⚠ {errorText}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => composeActor.send({ type: 'BACK_TO_COMPOSE' })}
              disabled={submitting}
              className="rounded-md border border-white/15 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 disabled:opacity-50"
            >
              ← 다시 쓰기
            </button>
            <button
              type="submit"
              disabled={submitting || fragments.length === 0}
              className="flex-1 rounded-md bg-indigo-500/80 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {submitting ? '별 띄우는 중…' : `별 띄우기 (${fragments.length})`}
            </button>
          </div>
        </>
      )}
    </form>
  )
}
