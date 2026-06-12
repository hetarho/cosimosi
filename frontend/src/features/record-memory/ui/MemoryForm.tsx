// Compose form (spec 10, reshaped by 21 + the review step) — a 2D HUD, rendered
// OUTSIDE the R3F canvas (no DOM in the scene, Architecture §3.1). Two phases:
//   compose: 본문 + 날짜 → "별로 분해" (SegmentMemory 동기 미리보기, 저장 없음)
//   review:  AI가 나눈 조각·감정을 확인/수정/추가/삭제 → "별 띄우기" (확정 제출)
// The AI's split is therefore never persisted unseen — a wrong segmentation is
// fixed (or discarded) here before any star exists.
import { Mood } from '@/shared/api'
import { moodFromProto } from '@/entities/memory'
import { useAppearance } from '@/entities/appearance'
import { MOOD_AFFECT, moodLabel, resolveMoodRgb } from '@/shared/config'
import { MAX_FRAGMENTS, type DraftFragment } from '../api/record-memory'
import { useDraftStore } from '../model/draft-store'
import { useRecordMemory } from '../model/use-record-memory'

// 13 moods in quadrant order (spec 29): HAP → LAP → HAN → LAN → neutral.
// Labels come from MOOD_LABEL via moodLabel (single source — not re-listed here).
const MOOD_OPTIONS: Mood[] = [
  Mood.JOY,
  Mood.EXCITEMENT,
  Mood.LOVE,
  Mood.CALM,
  Mood.GRATITUDE,
  Mood.RELIEF,
  Mood.ANGER,
  Mood.FEAR,
  Mood.STRESS,
  Mood.SAD,
  Mood.TIRED,
  Mood.EMPTINESS,
  Mood.NEUTRAL,
]

const inputCls =
  'rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/30'

/** mood → CSS color (사용자 감정색 오버라이드 반영, spec 30) — 조각 카드의 별색 점. */
function moodCss(mood: Mood, overrides?: Record<string, string>): string {
  const [r, g, b] = resolveMoodRgb(moodFromProto(mood), overrides)
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`
}

/** 검토 단계의 조각 한 장: 별색 점 + 감정 선택 + 강도 + 본문 + 삭제.
 *  disabled = 제출 중 — 제출은 클릭 시점의 스냅샷을 보내므로, 그동안의 편집이
 *  성공 reset()에 조용히 증발하지 않게 입력을 잠근다. */
function FragmentCard({ fragment, disabled }: { fragment: DraftFragment; disabled: boolean }) {
  const updateFragment = useDraftStore((s) => s.updateFragment)
  const removeFragment = useDraftStore((s) => s.removeFragment)
  const emotionColors = useAppearance((s) => s.emotionColors)
  const color = moodCss(fragment.mood, emotionColors)
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
        />
        <select
          aria-label="조각 감정"
          className={`${inputCls} flex-1 py-1 text-xs`}
          value={String(fragment.mood)}
          disabled={disabled}
          onChange={(e) => {
            const mood = Number(e.target.value) as Mood
            // 감정을 바꾸면 AI가 매겼던 valence는 옛 감정의 것 — 새 감정의 circumplex
            // 근사값(MOOD_AFFECT)으로 함께 갱신해 별의 물리(감쇠 λ_eff)와 색이 어긋나지
            // 않게 한다. 강도는 사용자가 슬라이더로 직접 다듬는 값이라 보존.
            updateFragment(fragment.id, { mood, valence: MOOD_AFFECT[moodFromProto(mood)].valence })
          }}
        >
          {MOOD_OPTIONS.map((m) => (
            <option key={m} value={String(m)}>
              {moodLabel(moodFromProto(m))}
            </option>
          ))}
        </select>
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
            onChange={(e) => updateFragment(fragment.id, { intensity: Number(e.target.value) })}
          />
        </label>
        <button
          type="button"
          aria-label="조각 삭제"
          disabled={disabled}
          onClick={() => removeFragment(fragment.id)}
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
        onChange={(e) => updateFragment(fragment.id, { text: e.target.value })}
      />
    </li>
  )
}

export function MemoryForm() {
  const { body, entryDate, phase, fragments, status, errorText, setBody, setEntryDate, addFragment, backToCompose } =
    useDraftStore()
  const { segment, submit } = useRecordMemory()
  const segmenting = status === 'segmenting'
  const submitting = status === 'submitting'

  return (
    <form
      className="flex w-full flex-col gap-3 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur"
      onSubmit={(e) => {
        e.preventDefault()
        void (phase === 'compose' ? segment() : submit())
      }}
    >
      {phase === 'compose' ? (
        <>
          <h2 className="text-sm font-medium text-white/80">새 일기 — 별 띄우기</h2>
          {/* ph-no-capture: 일기 본문 입력 — PostHog autocapture가 이 요소를 아예 건드리지
              않게 한다(스펙 18 프라이버시 헌법 3; mask_all_text 위의 이중 가드).
              분해 중에는 잠근다 — 분해는 클릭 시점의 본문 스냅샷으로 돌아가므로, 그동안
              덧붙인 문장은 조각이 되지 못한 채 기록 원본에만 남는 어긋남이 생긴다. */}
          <textarea
            className={`${inputCls} ph-no-capture h-24 resize-none`}
            placeholder="오늘의 기억을 적어보세요…"
            value={body}
            disabled={segmenting}
            onChange={(e) => setBody(e.target.value)}
          />
          <label className="flex flex-col gap-1 text-xs text-white/50">
            시점
            <input
              type="date"
              className={inputCls}
              value={entryDate}
              disabled={segmenting}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </label>

          {segmenting && (
            <p className="rounded-md bg-indigo-500/10 px-2 py-1 text-xs text-indigo-200/90">
              ✦ 기억을 조각내는 중… 장면마다 별이 될 조각으로 나눠요.
            </p>
          )}
          {status === 'error' && errorText && (
            <p className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">⚠ {errorText}</p>
          )}
          <button
            type="submit"
            disabled={segmenting}
            className="rounded-md bg-indigo-500/80 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {segmenting ? '조각내는 중…' : '✦ 별로 분해'}
          </button>
        </>
      ) : (
        <>
          <h2 className="text-sm font-medium text-white/80">
            조각 확인 — 별 {fragments.length}개
          </h2>
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
            onClick={addFragment}
            disabled={submitting || fragments.length >= MAX_FRAGMENTS}
            className="rounded-md border border-dashed border-white/20 px-3 py-1.5 text-xs text-white/60 transition hover:border-white/40 hover:text-white/90 disabled:opacity-40"
          >
            ＋ 조각 추가{fragments.length >= MAX_FRAGMENTS ? ` (최대 ${MAX_FRAGMENTS}개)` : ''}
          </button>

          {status === 'error' && errorText && (
            <p className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">⚠ {errorText}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={backToCompose}
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
              {submitting ? '별 띄우는 중…' : `✦ 별 띄우기 (${fragments.length})`}
            </button>
          </div>
        </>
      )}
    </form>
  )
}
