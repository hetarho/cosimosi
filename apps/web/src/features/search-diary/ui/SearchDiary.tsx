import { useId } from 'react'

import type { GetDiariesInput } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { MOODS, moodColor } from '@cosimosi/emotion'
import { useDiaryConditions, type DiaryConditionsUpdate } from '@cosimosi/universe/react'
import {
  Button,
  IconButton,
  NewestFirstIcon,
  OldestFirstIcon,
  ResetIcon,
  Select,
  TextField,
  Tooltip,
} from '@cosimosi/ui'

import { m, moodLabel, diaryMemoryCountLabel } from '../../../shared/i18n/index.ts'

export interface SearchDiaryProps {
  value: GetDiariesInput
  onChange: (update: DiaryConditionsUpdate) => void
  /** Whether the mood panel is unfolded. Held by the composing widget, which outlives every branch
   *  the archive body swaps between — a disclosure that lived here would refold on each read. */
  moodsOpen: boolean
  onMoodsOpenChange: (open: boolean) => void
  /** Whether the order control is meaningful. It steers the LIST, so the calendar hides it ([D12]). */
  sortable?: boolean
}

// features/search-diary ui ([D8][D9]): the archive's conditions — a keyword over the immutable body,
// the 13-mood filter, how many stars a diary still has, and which end of the archive is on top. The
// draft/commit rules live in the shared useDiaryConditions hook so both platforms search on identical
// terms; this file is only the controls. Free by construction: nothing here quotes, spends, or moves
// the clock ([D11][T3]).
//
// The controls are ONE ROW that wraps — keyword, order, feelings, star count, and the way back out —
// rather than a panel of their own. They carry no card, border or fill: a plate around the conditions
// would read as a second surface competing with the archive, which is the only thing on this page
// worth framing. On a narrow screen the row wraps into a stack, so the same markup is the phone's
// gathered block and the desktop's toolbar with no breakpoint deciding which controls exist.
//
// The thirteen mood chips still fold away behind a toggle: they are two rows of colour that most
// readings never touch. The toggle carries the count while it is closed, so a folded panel can never
// hide an active filter, and 조건 지우기 stays OUTSIDE the fold for the same reason — a filtered
// archive must always have a visible way back out of the filter.
export function SearchDiary({
  value,
  onChange,
  moodsOpen,
  onMoodsOpenChange,
  sortable = true,
}: SearchDiaryProps) {
  const conditions = useDiaryConditions(value, onChange)
  const moodPanelId = useId()
  const selectedMoods = conditions.moods.length
  const sortAction = conditions.oldestFirst
    ? m.diary_reader_sort_to_newest()
    : m.diary_reader_sort_to_oldest()

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* The keyword takes the slack on a wide row and the whole width on a narrow one, because it
            is the only condition here that holds typed text. */}
        <div className="min-w-56 flex-1">
          <TextField
            size="sm"
            aria-label={m.diary_search_keyword_label()}
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
        </div>

        {/* The order is a TOGGLE that says where it is, not a pair of switches: there are exactly two
            directions, so a control offering both spends a row's width restating that. The glyph
            follows the direction and the accessible name is the ACTION, so the button still announces
            what pressing it does rather than only what it shows. */}
        {sortable && (
          <Button
            color="neutral"
            size="sm"
            aria-label={sortAction}
            trailingIcon={conditions.oldestFirst ? <OldestFirstIcon /> : <NewestFirstIcon />}
            onClick={conditions.toggleSort}
          >
            {conditions.oldestFirst ? m.diary_reader_sort_oldest() : m.diary_reader_sort_newest()}
          </Button>
        )}

        <Button
          color="neutral"
          size="sm"
          aria-expanded={moodsOpen}
          aria-controls={moodsOpen ? moodPanelId : undefined}
          onClick={() => onMoodsOpenChange(!moodsOpen)}
        >
          {selectedMoods > 0
            ? `${m.diary_search_mood_toggle()} ${m.diary_search_mood_selected({ count: selectedMoods })}`
            : m.diary_search_mood_toggle()}
        </Button>

        {/* How many stars a diary still carries. A `<select>` rather than a row of chips: the choices
            are a short ordered scale, and spending five slots of the toolbar on a number would give
            the count more of the line than the keyword. */}
        <div className="w-36 shrink-0">
          <Select
            size="sm"
            ariaLabel={m.diary_search_memory_count_label()}
            value={conditions.memoryCount}
            onValueChange={conditions.setMemoryCount}
            items={conditions.memoryCountOptions.map((option) => ({
              value: option,
              label: diaryMemoryCountLabel(option, VALUES.encode.maxMemories),
            }))}
          />
        </div>

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
