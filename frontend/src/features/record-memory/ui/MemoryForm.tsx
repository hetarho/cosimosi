// Compose form (spec 10) — a 2D HUD, rendered OUTSIDE the R3F canvas (no DOM in the
// scene, Architecture §3.1). Body + mood + intensity + date → submit drives the
// optimistic record flow.
import { Mood } from '@/shared/api'
import { moodFromProto } from '@/entities/memory'
import { moodLabel } from '@/shared/config'
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

export function MemoryForm() {
  const { body, mood, intensity, entryDate, status, errorText, setBody, setMood, setIntensity, setEntryDate } =
    useDraftStore()
  const { submit } = useRecordMemory()
  const submitting = status === 'submitting'

  return (
    <form
      className="flex w-full flex-col gap-3 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <h2 className="text-sm font-medium text-white/80">새 일기 — 별 띄우기</h2>
      {/* ph-no-capture: 일기 본문 입력 — PostHog autocapture가 이 요소를 아예 건드리지
          않게 한다(스펙 18 프라이버시 헌법 3; mask_all_text 위의 이중 가드). */}
      <textarea
        className={`${inputCls} ph-no-capture h-24 resize-none`}
        placeholder="오늘의 기억을 적어보세요…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-white/50">
          감정
          <select
            className={inputCls}
            value={String(mood)}
            onChange={(e) => setMood(Number(e.target.value) as Mood)}
          >
            {MOOD_OPTIONS.map((m) => (
              <option key={m} value={String(m)}>
                {moodLabel(moodFromProto(m))}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-white/50">
          시점
          <input
            type="date"
            className={inputCls}
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs text-white/50">
        강도 {intensity.toFixed(2)}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
        />
      </label>
      {status === 'error' && errorText && (
        <p className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">⚠ {errorText}</p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-indigo-500/80 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {submitting ? '별 띄우는 중…' : '기록하기'}
      </button>
    </form>
  )
}
