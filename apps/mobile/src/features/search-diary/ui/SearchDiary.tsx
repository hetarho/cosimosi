import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { GetDiariesInput } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { MOODS, moodColor } from '@cosimosi/emotion'
import { useDiaryConditions, type DiaryConditionsUpdate } from '@cosimosi/universe/react'
import { Button, IconButton, ResetIcon, TextField, tokens } from '@cosimosi/ui'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

export interface SearchDiaryProps {
  value: GetDiariesInput
  onChange: (update: DiaryConditionsUpdate) => void
  /** Whether the mood panel is unfolded. Held by the composing widget, which outlives every branch
   *  the archive body swaps between — a disclosure that lived here would refold on each read. */
  moodsOpen: boolean
  onMoodsOpenChange: (open: boolean) => void
}

// features/search-diary ui (RN fork, [D8][D9]): the archive's conditions — a keyword over the
// immutable body and the 13-mood filter. The draft/commit rules live in the shared
// useDiaryConditions hook, so both platforms search on identical terms.
//
// The keyword stands in the open and the thirteen chips fold away behind a toggle, as on web: the
// chips are two rows of colour that most readings never touch. The toggle carries the count while it
// is closed and 조건 지우기 stays outside the fold, so a folded panel can neither hide an active
// filter nor take away the way out of one.
export function SearchDiary({ value, onChange, moodsOpen, onMoodsOpenChange }: SearchDiaryProps) {
  const conditions = useDiaryConditions(value, onChange)
  const selectedMoods = conditions.moods.length

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
  panel: {
    gap: tokens.spacing[3],
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    backgroundColor: tokens.color.surface,
    padding: tokens.spacing[3],
  },
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
