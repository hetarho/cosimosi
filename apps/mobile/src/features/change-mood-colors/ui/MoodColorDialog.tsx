import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import {
  clampChromaToGamut,
  draftFromColor,
  draftFromOkLch,
  moodColorPresets,
  moodColorRisks,
  okLchToColor,
  randomMoodColor,
  type Color,
  type Mood,
  type MoodColorConcern,
  type MoodColorPreset,
} from '@cosimosi/emotion'
import { moodColorPresetsQueryKey, readMoodColorPresets } from '@cosimosi/emotion/react'
import { Button, Dialog, tokens } from '@cosimosi/ui'

import {
  m,
  moodColorPresetDetail,
  moodColorPresetTitle,
  moodColorRiskText,
  moodLabel,
} from '../../../shared/i18n/index.ts'
import { MoodColorPicker } from './MoodColorPicker.tsx'

export interface MoodColorDialogProps {
  mood: Mood
  current: Color
  /** What the other twelve feelings wear, so "too close to another feeling" can be said WHILE choosing
   *  rather than reported after the save. Keyed by mood; the edited one is ignored if present. */
  otherColors: Readonly<Partial<Record<Mood, Color>>>
  saving: boolean
  onClose: () => void
  onSave: (color: Color) => void
}

/**
 * Editing one feeling's colour. Nothing writes until Save, so a colour can be tried against the one
 * it would replace and abandoned without the sky behind moving.
 */
export function MoodColorDialog({
  mood,
  current,
  otherColors,
  saving,
  onClose,
  onSave,
}: MoodColorDialogProps) {
  const transport = useTransport()
  const presetQuery = useQuery({
    queryKey: moodColorPresetsQueryKey(mood),
    queryFn: () => readMoodColorPresets(transport, mood),
    staleTime: Number.POSITIVE_INFINITY,
  })
  // The authored and random offers hold without the aggregate, so they render while it loads and
  // remain the whole row if the read fails.
  const presets = presetQuery.data ?? moodColorPresets(mood, [])

  // Seeded once; the host mounts this per feeling, so opening is what re-reads `current`. A failed
  // save must not snap the draft back to the rolled-back colour, since Save is what gets pressed next.
  const [draft, setDraft] = useState(() => draftFromColor(current))
  const [confirming, setConfirming] = useState(false)

  const risks = useMemo(
    () => moodColorRisks(mood, draft.color, otherColors),
    [mood, draft.color, otherColors],
  )

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={m.palette_dialog_title({ mood: moodLabel(mood) })}
        description={m.palette_dialog_body()}
        closeLabel={m.common_dismiss()}
      >
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.preview}>
            <PreviewSwatch color={current} label={m.palette_current_label()} />
            <PreviewSwatch color={draft.color} label={m.palette_preview_label()} />
          </View>
          <View style={styles.presets}>
            {presets.map((preset) => (
              <PresetButton
                key={preset.kind === 'POPULAR' ? preset.color : preset.kind}
                preset={preset}
                selected={preset.kind !== 'RANDOM' && preset.color === draft.color}
                disabled={saving}
                onChoose={(color) => setDraft(draftFromColor(color))}
                onRandom={() => setDraft(draftFromColor(randomMoodColor(mood)))}
              />
            ))}
          </View>
          <MoodColorPicker
            value={draft.lch}
            disabled={saving}
            onChange={(lch) => setDraft(draftFromOkLch(lch))}
          />
          {/* Live rather than on save, so the notice tracks the colour under the thumb. */}
          {risks.length > 0 ? <RiskNotice risks={risks} /> : null}
          <View style={styles.actions}>
            <Button color="neutral" variant="text" onPress={onClose} disabled={saving}>
              {m.common_cancel()}
            </Button>
            <Button
              loading={saving}
              onPress={() => (risks.length > 0 ? setConfirming(true) : onSave(draft.color))}
            >
              {m.palette_save()}
            </Button>
          </View>
        </ScrollView>
      </Dialog>
      {/* Only opens when there is a risk to state; a clean colour saves on the first press. */}
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={m.palette_confirm_title()}
        description={m.palette_confirm_body({ mood: moodLabel(mood) })}
        closeLabel={m.common_dismiss()}
      >
        <View style={styles.body}>
          <RiskNotice risks={risks} />
          <View style={styles.actions}>
            <Button color="neutral" variant="text" onPress={() => setConfirming(false)}>
              {m.common_cancel()}
            </Button>
            <Button
              loading={saving}
              onPress={() => {
                setConfirming(false)
                onSave(draft.color)
              }}
            >
              {m.palette_confirm_keep()}
            </Button>
          </View>
        </View>
      </Dialog>
    </>
  )
}

// The sentences alone, with no heading over them. A caption naming the notice said nothing the
// sentences do not already say, in a voice nobody speaks.
function RiskNotice({ risks }: { risks: readonly MoodColorConcern[] }) {
  return (
    <View accessibilityRole="alert" style={styles.risks}>
      {risks.map((concern) => (
        <Text key={concern.risk} style={styles.risk}>
          {moodColorRiskText(concern)}
        </Text>
      ))}
    </View>
  )
}

function PreviewSwatch({ color, label }: { color: Color; label: string }) {
  return (
    <View style={styles.previewItem}>
      <View style={[styles.previewSwatch, { backgroundColor: color, shadowColor: color }]} />
      <Text style={styles.previewLabel}>{label}</Text>
    </View>
  )
}

function PresetButton({
  preset,
  selected,
  disabled,
  onChoose,
  onRandom,
}: {
  preset: MoodColorPreset
  selected: boolean
  disabled: boolean
  onChoose: (color: Color) => void
  onRandom: () => void
}) {
  const detail = moodColorPresetDetail(preset)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={m.palette_preset_label()}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => (preset.kind === 'RANDOM' ? onRandom() : onChoose(preset.color))}
      style={({ pressed }) => [
        styles.preset,
        selected && styles.presetSelected,
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      {/* Random has no colour to show. Native has no conic gradient, so the wheel is a row of dots,
          one per sector of the OkLCH circle. */}
      {preset.kind === 'RANDOM' ? (
        <View style={styles.wheel}>
          {RANDOM_HUES.map((color) => (
            <View key={color} style={[styles.wheelDot, { backgroundColor: color }]} />
          ))}
        </View>
      ) : (
        <View style={[styles.presetSwatch, { backgroundColor: preset.color }]} />
      )}
      <Text style={styles.presetTitle}>{moodColorPresetTitle(preset)}</Text>
      {detail ? <Text style={styles.presetDetail}>{detail}</Text> : null}
    </Pressable>
  )
}

const RANDOM_HUES = Array.from({ length: 6 }, (_, index) =>
  okLchToColor(clampChromaToGamut({ l: 0.72, c: 0.2, h: (index * 360) / 6 })),
)

const styles = StyleSheet.create({
  body: { gap: 16 },
  preview: {
    alignItems: 'center',
    backgroundColor: tokens.color.bg,
    borderRadius: tokens.radius.lg,
    flexDirection: 'row',
    gap: 32,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  previewItem: { alignItems: 'center', gap: 8 },
  previewSwatch: {
    borderRadius: 24,
    height: 48,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    width: 48,
  },
  previewLabel: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    alignItems: 'center',
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 6,
    justifyContent: 'center',
    minHeight: 96,
    padding: 8,
  },
  presetSelected: { borderColor: tokens.color.text },
  dimmed: { opacity: 0.6 },
  presetSwatch: {
    borderColor: tokens.color.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    width: 32,
  },
  wheel: { flexDirection: 'row', gap: 2 },
  wheelDot: { borderRadius: 5, height: 10, width: 10 },
  presetTitle: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.xs,
    fontWeight: '500',
    textAlign: 'center',
  },
  presetDetail: {
    color: tokens.color['text-muted'],
    fontSize: tokens.fontSize.xs,
    textAlign: 'center',
  },
  risks: { gap: 4 },
  risk: { color: tokens.color.warning, fontSize: tokens.fontSize.sm },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
})
