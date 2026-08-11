import { useId } from 'react'

import type { GetDiariesInput } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { MOODS, moodColor } from '@cosimosi/emotion'
import { useDiaryConditions, type DiaryConditionsUpdate } from '@cosimosi/universe/react'
import { Button, IconButton, ResetIcon, TextField, Tooltip } from '@cosimosi/ui'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

export interface SearchDiaryProps {
  value: GetDiariesInput
  onChange: (update: DiaryConditionsUpdate) => void
  /** Whether the mood panel is unfolded. Held by the composing widget, which outlives every branch
   *  the archive body swaps between — a disclosure that lived here would refold on each read. */
  moodsOpen: boolean
  onMoodsOpenChange: (open: boolean) => void
}

// features/search-diary ui ([D8][D9]): the archive's conditions — a keyword over the immutable body
// and the 13-mood filter. The draft/commit rules live in the shared useDiaryConditions hook so both
// platforms search on identical terms; this file is only the controls. Free by construction: nothing
// here quotes, spends, or moves the clock ([D11][T3]).
//
// The keyword stands in the open and the thirteen mood chips fold away behind a toggle: the chips
// are two rows of colour that most readings never touch, and the archive is a page for reading. The
// toggle carries the count while it is closed, so a folded panel can never hide an active filter,
// and 조건 지우기 stays OUTSIDE the fold for the same reason — a filtered archive must always have a
// visible way back out of the filter.
export function SearchDiary({ value, onChange, moodsOpen, onMoodsOpenChange }: SearchDiaryProps) {
  const conditions = useDiaryConditions(value, onChange)
  const moodPanelId = useId()
  const selectedMoods = conditions.moods.length

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3">
      <TextField
        size="sm"
        label={m.diary_search_keyword_label()}
        placeholder={m.diary_search_keyword_placeholder()}
        value={conditions.keywordDraft}
        error={
          conditions.keywordTooShort
            ? m.diary_search_keyword_too_short({
                count: VALUES.diaryReader.searchMinQueryLength,
              })
            : undefined
        }
        onChange={(event) => conditions.setKeywordDraft(event.target.value)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          color="neutral"
          size="sm"
          aria-expanded={moodsOpen}
          aria-controls={moodsOpen ? moodPanelId : undefined}
          onClick={() => onMoodsOpenChange(!moodsOpen)}
        >
          {m.diary_search_mood_toggle()}
        </Button>
        {selectedMoods > 0 && (
          <span className="text-xs text-text-muted">
            {m.diary_search_mood_selected({ count: selectedMoods })}
          </span>
        )}
        {conditions.hasConditions && (
          <Tooltip content={m.diary_reader_clear_conditions()}>
            <IconButton
              color="neutral"
              size="sm"
              label={m.diary_reader_clear_conditions()}
              icon={<ResetIcon />}
              onClick={conditions.clear}
            />
          </Tooltip>
        )}
      </div>

      {/* The panel's name is the toggle that opened it, so a legend would only say 감정 twice. A
          `role="group"` carrying that same name keeps the chips announced as one set. */}
      {moodsOpen && (
        <div
          id={moodPanelId}
          role="group"
          aria-label={m.diary_search_mood_toggle()}
          className="flex flex-col gap-1.5"
        >
          <ul className="flex flex-wrap gap-1.5">
            {MOODS.map((mood) => {
              const selected = conditions.moods.includes(mood)
              return (
                <li key={mood}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => conditions.toggleMood(mood)}
                    // A chosen chip is LIT — its own feeling's colour on the rim and in a halo around
                    // it — while an unchosen one is a quiet outline holding a dimmed dot. Choosing
                    // nothing is what shows everything, so the resting state has to read as off; a
                    // row of thirteen fully-lit dots read as thirteen switches already thrown.
                    style={
                      selected
                        ? {
                            borderColor: moodColor(mood),
                            boxShadow: `0 0 10px -2px ${moodColor(mood)}`,
                          }
                        : undefined
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                      selected
                        ? 'bg-surface-raised font-medium text-text'
                        : 'border-border text-text-muted hover:text-text'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={
                        selected ? 'h-2 w-2 rounded-full' : 'h-2 w-2 rounded-full opacity-40'
                      }
                      style={{ backgroundColor: moodColor(mood) }}
                    />
                    {moodLabel(mood)}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
