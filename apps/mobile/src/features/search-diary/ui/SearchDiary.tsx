import { Pressable, StyleSheet, Text, View } from 'react-native'

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
  tokens,
} from '@cosimosi/ui'

import { diaryMemoryCountLabel, m, moodLabel } from '../../../shared/i18n/index.ts'

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

// features/search-diary ui (RN fork, [D8][D9]): the archive's conditions — a keyword over the
// immutable body, the 13-mood filter, how many stars a diary still has, and which end of the archive
// is on top. The draft/commit rules and the count-choice table live in the shared useDiaryConditions
// hook, so both platforms search on identical terms.
//
// The controls carry no card of their own, as on web: a plate around the conditions would read as a
// second surface competing with the archive. They stay a gathered block rather than a wide toolbar —
// there is no width here to spread them across.
//
// The keyword stands in the open and the thirteen chips fold away behind a toggle: the chips are two
// rows of colour that most readings never touch. The toggle carries the count while it is closed and
// 조건 지우기 stays outside the fold, so a folded panel can neither hide an active filter nor take
// away the way out of one.
export function SearchDiary({
  value,
  onChange,
  moodsOpen,
  onMoodsOpenChange,
  sortable = true,
}: SearchDiaryProps) {
  const conditions = useDiaryConditions(value, onChange)
  const selectedMoods = conditions.moods.length
  const sortAction = conditions.oldestFirst
    ? m.diary_reader_sort_to_newest()
    : m.diary_reader_sort_to_oldest()

  return (
    <View style={styles.panel}>
      <TextField
        label={m.diary_search_keyword_label()}
        placeholder={m.diary_search_keyword_placeholder()}
        value={conditions.keywordDraft}
        onChangeText={conditions.setKeywordDraft}
        autoCapitalize="none"
        error={
          conditions.keywordTooShort
            ? m.diary_search_keyword_too_short({
                count: VALUES.diaryReader.searchMinQueryLength,
              })
            : undefined
        }
      />

      <View style={styles.toggleRow}>
        {/* The order is a TOGGLE that says where it is: there are exactly two directions, so a control
            offering both spends the row restating that. The glyph follows the direction and the
            accessible name is the ACTION, so it still announces what a press does. */}
        {sortable && (
          <Button
            color="neutral"
            size="sm"
            accessibilityLabel={sortAction}
            trailingIcon={
              conditions.oldestFirst ? (
                <OldestFirstIcon color={tokens.color.text} />
              ) : (
                <NewestFirstIcon color={tokens.color.text} />
              )
            }
            onPress={conditions.toggleSort}
          >
            {conditions.oldestFirst ? m.diary_reader_sort_oldest() : m.diary_reader_sort_newest()}
          </Button>
        )}
        <Button
          color="neutral"
          size="sm"
          accessibilityState={{ expanded: moodsOpen }}
          onPress={() => onMoodsOpenChange(!moodsOpen)}
        >
          {m.diary_search_mood_toggle()}
        </Button>
        {selectedMoods > 0 && (
          <Text style={styles.count}>{m.diary_search_mood_selected({ count: selectedMoods })}</Text>
        )}
        {conditions.hasConditions && (
          <IconButton
            color="neutral"
            size="sm"
            label={m.diary_reader_clear_conditions()}
            icon={<ResetIcon color={tokens.color.text} />}
            onPress={conditions.clear}
          />
        )}
      </View>

      {/* How many stars a diary still carries. A picker rather than a row of chips: the choices are a
          short ordered scale, and five more chips beside thirteen mood chips would read as one field. */}
      <Select
        ariaLabel={m.diary_search_memory_count_label()}
        value={conditions.memoryCount}
        onValueChange={conditions.setMemoryCount}
        items={conditions.memoryCountOptions.map((option) => ({
          value: option,
          label: diaryMemoryCountLabel(option, VALUES.encode.maxMemories),
        }))}
      />

      {/* The panel's name is the toggle that opened it, so a legend would only say 감정 twice — the
          group carries that same name instead, so the chips are never announced as a bare row. */}
      {moodsOpen && (
        <View accessibilityLabel={m.diary_search_mood_toggle()} style={styles.chips}>
          {MOODS.map((mood) => {
            const selected = conditions.moods.includes(mood)
            return (
              <Pressable
                key={mood}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={moodLabel(mood)}
                onPress={() => conditions.toggleMood(mood)}
                style={[
                  styles.chip,
                  selected && styles.chipSelected,
                  // A chosen chip is LIT in its own feeling's colour; an unchosen one is a quiet
                  // outline holding a dimmed dot. Choosing nothing is what shows everything, so
                  // the resting state has to read as off. RN has no glow, so the rim carries it.
                  selected && { borderColor: moodColor(mood) },
                ]}
              >
                <View
                  accessible={false}
                  importantForAccessibility="no"
                  style={[
                    styles.dot,
                    { backgroundColor: moodColor(mood) },
                    !selected && styles.dotMuted,
                  ]}
                />
                <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                  {moodLabel(mood)}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { gap: tokens.spacing[3] },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  count: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: tokens.spacing[1],
  },
  chipSelected: { backgroundColor: tokens.color['surface-raised'] },
  dot: { height: 8, width: 8, borderRadius: tokens.radius.full },
  dotMuted: { opacity: 0.4 },
  chipLabel: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
  chipLabelSelected: { color: tokens.color.text, fontWeight: '500' },
})
