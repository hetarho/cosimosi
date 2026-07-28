import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import {
  PostFX,
  SkySphere,
  UNIVERSE_SKINS,
  UniverseCanvas,
  resolveActiveSkin,
} from '@cosimosi/3d-renderer'
import { VALUES } from '@cosimosi/config'
import { MOODS, type Color, type Mood, type MoodColorRow } from '@cosimosi/emotion'
import {
  completeMoodColorRecommendations,
  readMoodColorRecommendations,
  useMoodColorEditor,
} from '@cosimosi/emotion/react'
import { Button, Card, tokens, useReducedMotion } from '@cosimosi/ui'
import { MoodStarLayer } from '@cosimosi/universe-render'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

const EMPTY_ROWS: readonly MoodColorRow[] = []

export function ChooseMoodColors({ onContinue }: { onContinue: () => void }) {
  const editor = useMoodColorEditor(EMPTY_ROWS)
  const [selectedMood, setSelectedMood] = useState<Mood>('JOY')
  const { colorFor } = editor
  const colors = useMemo(
    () => Object.fromEntries(MOODS.map((mood) => [mood, colorFor(mood)])) as Record<Mood, Color>,
    [colorFor],
  )
  const skin = UNIVERSE_SKINS[resolveActiveSkin(VALUES.rendering.activeSkin)]
  const reducedMotion = useReducedMotion()
  const stops = useMemo(() => [{ color: skin.sky.night, weight: 1 }], [skin.sky.night])

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <UniverseCanvas
          dpr={[1, VALUES.rendering.maxPixelRatio]}
          fov={skin.camera.fov}
          clearColor={skin.sky.night}
        >
          <SkySphere stops={stops} effect={skin.sky.effect} reducedMotion={reducedMotion} />
          <MoodStarLayer colors={colors} reducedMotion={reducedMotion} onSelect={setSelectedMood} />
          <PostFX bloom={skin.bloom} />
        </UniverseCanvas>
      </View>
      <View pointerEvents="box-none" style={styles.overlay}>
        <View>
          <Text style={styles.title}>{m.mood_color_onboarding_title()}</Text>
          <Text style={styles.body}>{m.mood_color_onboarding_body()}</Text>
        </View>
        <View style={styles.controls}>
          <MoodRecommendations
            mood={selectedMood}
            current={editor.colorFor(selectedMood)}
            disabled={editor.savingMood !== undefined}
            onChoose={(color) => editor.choose(selectedMood, color)}
          />
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
          <Button onPress={onContinue}>{m.mood_color_onboarding_skip()}</Button>
        </View>
      </View>
    </View>
  )
}

function MoodRecommendations({
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
    queryKey: ['onboarding-mood-color-recommendations', mood],
    queryFn: () => readMoodColorRecommendations(transport, mood),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const recommendations = query.data ?? completeMoodColorRecommendations(mood, [])

  return (
    <Card style={styles.card}>
      <View style={styles.rowTitle}>
        <View style={[styles.current, { backgroundColor: current }]} />
        <Text style={styles.name}>{moodLabel(mood)}</Text>
      </View>
      <View style={styles.recommendations}>
        {recommendations.map((recommendation) => (
          <Pressable
            key={`${recommendation.bucket ?? 'authored'}-${recommendation.color}`}
            accessibilityRole="button"
            accessibilityLabel={m.palette_recommendation_label()}
            accessibilityState={{
              selected: recommendation.color === current,
              disabled,
            }}
            disabled={disabled}
            onPress={() => onChoose(recommendation.color)}
            style={({ pressed }) => [
              styles.recommendation,
              recommendation.color === current && styles.selected,
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
        ))}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  root: { backgroundColor: tokens.color.bg, flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: tokens.spacing[6],
  },
  title: { color: tokens.color.text, fontSize: tokens.fontSize['2xl'], fontWeight: '600' },
  body: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm, marginTop: 8 },
  controls: { gap: 12 },
  card: { backgroundColor: tokens.color.surface, gap: 12, opacity: 0.94 },
  rowTitle: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  current: {
    borderColor: tokens.color.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    width: 20,
  },
  name: { color: tokens.color.text, fontSize: tokens.fontSize.base, fontWeight: '600' },
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
