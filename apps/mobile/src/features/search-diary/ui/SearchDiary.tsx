import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { GetDiariesInput } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { MOODS, moodColor } from '@cosimosi/emotion'
import { useDiaryConditions, type DiaryConditionsUpdate } from '@cosimosi/universe/react'
import { Button, TextField, tokens } from '@cosimosi/ui'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

export interface SearchDiaryProps {
  value: GetDiariesInput
  onChange: (update: DiaryConditionsUpdate) => void
}

// features/search-diary ui (RN fork, [D8][D9]): the archive's conditions — a keyword over the immutable
// body, the 13-mood filter, and an inclusive date range. The draft/commit rules live in the shared
// useDiaryConditions hook, so a half-typed date never becomes a request and both platforms search on
// identical terms. The date fields are plain text here, following the shipped write-diary precedent
// (no native date-picker dependency), which is why the ISO hint matters more than it does on web.
export function SearchDiary({ value, onChange }: SearchDiaryProps) {
  const conditions = useDiaryConditions(value, onChange)

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

      <View style={styles.group}>
        <Text style={styles.legend}>{m.diary_search_mood_label()}</Text>
        <View style={styles.chips}>
          {MOODS.map((mood) => {
            const selected = conditions.moods.includes(mood)
            return (
              <Pressable
                key={mood}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={moodLabel(mood)}
                onPress={() => conditions.toggleMood(mood)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <View
                  accessible={false}
                  importantForAccessibility="no"
                  style={[styles.dot, { backgroundColor: moodColor(mood) }]}
                />
                <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                  {moodLabel(mood)}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <View style={styles.dates}>
        <View style={styles.dateField}>
          <TextField
            label={m.diary_search_from_label()}
            placeholder={m.diary_search_date_placeholder()}
            value={conditions.fromDraft}
            onChangeText={conditions.setFromDraft}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={styles.dateField}>
          <TextField
            label={m.diary_search_to_label()}
            placeholder={m.diary_search_date_placeholder()}
            value={conditions.toDraft}
            onChangeText={conditions.setToDraft}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>
      {conditions.dateRangeInvalid && (
        <Text style={styles.rangeNotice}>{m.diary_search_range_invalid()}</Text>
      )}

      {conditions.hasConditions && (
        <Button color="neutral" size="sm" onPress={conditions.clear}>
          {m.diary_reader_clear_conditions()}
        </Button>
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
  group: { gap: tokens.spacing[2] },
  legend: { color: tokens.color.text, fontSize: tokens.fontSize.sm, fontWeight: '500' },
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
  chipSelected: { borderColor: 'transparent', backgroundColor: tokens.color.bg },
  dot: { height: 8, width: 8, borderRadius: tokens.radius.full },
  chipLabel: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
  chipLabelSelected: { color: tokens.color.text },
  dates: { flexDirection: 'row', gap: tokens.spacing[2] },
  dateField: { flex: 1 },
  rangeNotice: { color: tokens.color.danger, fontSize: tokens.fontSize.xs },
})
