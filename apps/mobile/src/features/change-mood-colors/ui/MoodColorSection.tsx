import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import { createGetMoodColorsQueryOptions } from '@cosimosi/api-client'
import { VALUES } from '@cosimosi/config'
import { MOODS, type Color, type Mood } from '@cosimosi/emotion'
import {
  completeMoodColorRecommendations,
  moodColorRows,
  readMoodColorRecommendations,
  useMoodColorEditor,
  type MoodColorRecommendation,
} from '@cosimosi/emotion/react'
import { Card, tokens } from '@cosimosi/ui'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

export function MoodColorSection() {
  const transport = useTransport()
  const query = useQuery({ ...createGetMoodColorsQueryOptions(transport), retry: false })
  const rows = useMemo(() => moodColorRows(query.data?.colors ?? []), [query.data?.colors])
  const editor = useMoodColorEditor(rows)

  return (
    <Card style={styles.card}>
      <View>
        <Text style={styles.title}>{m.palette_editor_title()}</Text>
        <Text style={styles.body}>{m.palette_editor_body()}</Text>
      </View>
      {query.isPending ? <Text style={styles.body}>{m.common_loading()}</Text> : null}
      {MOODS.map((mood) => (
        <MoodColorRow
          key={mood}
          mood={mood}
          current={editor.colorFor(mood)}
          disabled={query.isPending || editor.savingMood !== undefined}
          onChoose={(color) => editor.choose(mood, color)}
        />
      ))}
      {editor.duplicateMood ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {m.palette_near_duplicate({ mood: moodLabel(editor.duplicateMood) })}
        </Text>
      ) : null}
      {editor.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {m.palette_save_failed()}
        </Text>
      ) : null}
    </Card>
  )
}

function MoodColorRow({
  mood,
  current,
  disabled,
  onChoose,
}: {
  mood: Mood
  current: Color
  disabled: boolean
  onChoose: (color: Color) => void
}) {
  const transport = useTransport()
  const query = useQuery({
    queryKey: ['mood-color-recommendations', mood],
    queryFn: () => readMoodColorRecommendations(transport, mood),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const recommendations = query.data ?? completeMoodColorRecommendations(mood, [])

  return (
    <View style={styles.row}>
      <View style={styles.rowTitle}>
        <View style={[styles.current, { backgroundColor: current }]} />
        <Text style={styles.name}>{moodLabel(mood)}</Text>
      </View>
      <View style={styles.recommendations}>
        {recommendations.slice(0, VALUES.palette.recommendationCount).map((recommendation) => (
          <RecommendationButton
            key={`${recommendation.bucket ?? 'authored'}-${recommendation.color}`}
            recommendation={recommendation}
            selected={recommendation.color === current}
            disabled={disabled}
            onChoose={onChoose}
          />
        ))}
      </View>
    </View>
  )
}

function RecommendationButton({
  recommendation,
  selected,
  disabled,
  onChoose,
}: {
  recommendation: MoodColorRecommendation
  selected: boolean
  disabled: boolean
  onChoose: (color: Color) => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={m.palette_recommendation_label()}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => onChoose(recommendation.color)}
      style={({ pressed }) => [
        styles.recommendation,
        selected && styles.selected,
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <View style={[styles.swatch, { backgroundColor: recommendation.color }]} />
      <Text style={styles.share}>
        {recommendation.share === undefined
          ? m.palette_recommendation_usual()
          : m.palette_recommendation_share({
              percent: String(Math.round(recommendation.share * 100)),
            })}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { gap: tokens.spacing[4] },
  title: { color: tokens.color.text, fontSize: tokens.fontSize.base, fontWeight: '600' },
  body: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm, marginTop: 4 },
  row: { borderTopColor: tokens.color.border, borderTopWidth: 1, gap: 8, paddingTop: 12 },
  rowTitle: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  current: {
    borderColor: tokens.color.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 16,
    width: 16,
  },
  name: { color: tokens.color.text, fontSize: tokens.fontSize.sm, fontWeight: '500' },
  recommendations: { flexDirection: 'row', gap: 8 },
  recommendation: {
    alignItems: 'center',
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 72,
    padding: 8,
  },
  selected: { borderColor: tokens.color.primary },
  dimmed: { opacity: 0.6 },
  swatch: {
    borderColor: tokens.color.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 24,
    width: 24,
  },
  share: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs, textAlign: 'center' },
  notice: { color: tokens.color.warning, fontSize: tokens.fontSize.sm },
  error: { color: tokens.color.danger, fontSize: tokens.fontSize.sm },
})
