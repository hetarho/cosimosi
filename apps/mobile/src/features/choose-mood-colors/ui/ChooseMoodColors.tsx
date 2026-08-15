import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  PostFX,
  SkySphere,
  UNIVERSE_SKINS,
  UniverseCanvas,
  resolveActiveSkin,
} from '@cosimosi/3d-renderer'
import { VALUES } from '@cosimosi/config'
import {
  MOODS,
  clampChromaToGamut,
  moodColorPresets,
  okLchToColor,
  randomMoodColor,
  type Color,
  type Mood,
  type MoodColorRow,
} from '@cosimosi/emotion'
import {
  moodColorPresetsQueryKey,
  readMoodColorPresets,
  useMoodColorEditor,
} from '@cosimosi/emotion/react'
import { Alert, Button, Card, tokens, useReducedMotion } from '@cosimosi/ui'
import { MoodStarLayer } from '@cosimosi/universe-render'

import {
  m,
  moodColorPresetDetail,
  moodColorPresetTitle,
  moodLabel,
} from '../../../shared/i18n/index.ts'

const EMPTY_ROWS: readonly MoodColorRow[] = []

export function ChooseMoodColors({ onContinue }: { onContinue: () => void }) {
  const queryClient = useQueryClient()
  const editor = useMoodColorEditor(EMPTY_ROWS)
  const [selectedMood, setSelectedMood] = useState<Mood>('JOY')

  // A choice here joins the aggregate the presets are drawn from, so the cached shares stop being
  // true the moment it lands.
  const choose = async (mood: Mood, color: Color) => {
    if (!(await editor.choose(mood, color))) return
    await queryClient.invalidateQueries({ queryKey: moodColorPresetsQueryKey(mood) })
  }
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
          <MoodPresets
            mood={selectedMood}
            current={editor.colorFor(selectedMood)}
            disabled={editor.savingMood !== undefined}
            onChoose={(color) => {
              // Resolves either way; a failure surfaces in the notice below.
              choose(selectedMood, color)
            }}
          />
          {editor.duplicateMood ? (
            <Alert variant="warning" live="status">
              {m.palette_near_duplicate({ mood: moodLabel(editor.duplicateMood) })}
            </Alert>
          ) : null}
          {editor.error ? <Alert variant="danger">{m.palette_save_failed()}</Alert> : null}
          <Button onPress={onContinue}>{m.mood_color_onboarding_skip()}</Button>
        </View>
      </View>
    </View>
  )
}

/**
 * The first-run row: the same preset offers the 감정색 tab opens with, read against the live sky.
 * No picker and no risk gate — every offer here is already a colour the product stands behind, and
 * hand-tuning a hue is what the tab is for.
 */
function MoodPresets({
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
    queryKey: moodColorPresetsQueryKey(mood),
    queryFn: () => readMoodColorPresets(transport, mood),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const presets = query.data ?? moodColorPresets(mood, [])

  return (
    <Card style={styles.card}>
      <View style={styles.rowTitle}>
        <View style={[styles.current, { backgroundColor: current }]} />
        <Text style={styles.name}>{moodLabel(mood)}</Text>
      </View>
      <View style={styles.presets}>
        {presets.map((preset) => {
          const selected = preset.kind !== 'RANDOM' && preset.color === current
          const detail = moodColorPresetDetail(preset)
          const title = moodColorPresetTitle(preset)
          return (
            <Pressable
              key={preset.kind === 'POPULAR' ? preset.color : preset.kind}
              accessibilityRole="button"
              accessibilityLabel={title}
              accessibilityHint={m.palette_preset_label()}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() =>
                onChoose(preset.kind === 'RANDOM' ? randomMoodColor(mood) : preset.color)
              }
              style={({ pressed }) => [
                styles.preset,
                selected && styles.selected,
                (pressed || disabled) && styles.dimmed,
              ]}
            >
              {/* Random has no colour to show. Native has no conic gradient, so the wheel is a row
                  of dots, one per sector of the OkLCH circle. */}
              {preset.kind === 'RANDOM' ? (
                <View style={styles.wheel}>
                  {RANDOM_HUES.map((color) => (
                    <View key={color} style={[styles.wheelDot, { backgroundColor: color }]} />
                  ))}
                </View>
              ) : (
                <View style={[styles.swatch, { backgroundColor: preset.color }]} />
              )}
              <Text style={styles.presetTitle}>{title}</Text>
              {detail ? <Text style={styles.share}>{detail}</Text> : null}
            </Pressable>
          )
        })}
      </View>
    </Card>
  )
}

const RANDOM_HUES = Array.from({ length: 6 }, (_, index) =>
  okLchToColor(clampChromaToGamut({ l: 0.72, c: 0.2, h: (index * 360) / 6 })),
)

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
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    alignItems: 'center',
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 88,
    padding: 8,
  },
  presetTitle: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.xs,
    fontWeight: '500',
    textAlign: 'center',
  },
  wheel: { flexDirection: 'row', gap: 2 },
  wheelDot: { borderRadius: 5, height: 10, width: 10 },
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
})
