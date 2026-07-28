import type { GetDiariesInput } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { MOODS, moodColor } from '@cosimosi/emotion'
import { useDiaryConditions, type DiaryConditionsUpdate } from '@cosimosi/universe/react'
import { Button, TextField } from '@cosimosi/ui'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

export interface SearchDiaryProps {
  value: GetDiariesInput
  onChange: (update: DiaryConditionsUpdate) => void
}

// features/search-diary ui ([D8][D9]): the archive's conditions — a keyword over the immutable body,
// the 13-mood filter, and an inclusive date range. The draft/commit rules live in the shared
// useDiaryConditions hook so both platforms search on identical terms; this file is only the controls.
// Free by construction: nothing here quotes, spends, or moves the clock ([D11][T3]).
export function SearchDiary({ value, onChange }: SearchDiaryProps) {
  const conditions = useDiaryConditions(value, onChange)

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

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-text">{m.diary_search_mood_label()}</legend>
        <ul className="flex flex-wrap gap-1.5">
          {MOODS.map((mood) => {
            const selected = conditions.moods.includes(mood)
            return (
              <li key={mood}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => conditions.toggleMood(mood)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    selected
                      ? 'border-transparent bg-background text-text shadow-sm'
                      : 'border-border text-text-muted hover:text-text'
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: moodColor(mood) }}
                  />
                  {moodLabel(mood)}
                </button>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <div className="flex flex-wrap items-end gap-2">
        <TextField
          size="sm"
          type="date"
          label={m.diary_search_from_label()}
          value={conditions.fromDraft}
          onChange={(event) => conditions.setFromDraft(event.target.value)}
        />
        <TextField
          size="sm"
          type="date"
          label={m.diary_search_to_label()}
          value={conditions.toDraft}
          error={conditions.dateRangeInvalid ? m.diary_search_range_invalid() : undefined}
          onChange={(event) => conditions.setToDraft(event.target.value)}
        />
        {conditions.hasConditions && (
          <Button color="neutral" size="sm" onClick={conditions.clear}>
            {m.diary_reader_clear_conditions()}
          </Button>
        )}
      </div>
    </section>
  )
}
