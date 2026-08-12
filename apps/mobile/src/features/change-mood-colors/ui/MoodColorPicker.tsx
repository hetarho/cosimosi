import { Pressable, StyleSheet, Text, View } from 'react-native'

import {
  EMOTION_LIGHTNESS_STEPS,
  clampChromaToGamut,
  maxChromaInGamut,
  nearestEmotionStep,
  okLchToColor,
  type OkLch,
} from '@cosimosi/emotion'
import { SegmentedControl, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// A touch palette rather than the web's continuous sliders: a thumb cannot land a one-degree hue on
// a phone-width track. Same three axes as the web picker — hue, vividness, and the authored lightness
// steps — sampled into swatches big enough to press.
const HUE_SWATCHES = 24
const CHROMA_SWATCHES = 8

const LIGHTNESS_LABELS = [
  m.palette_lightness_light,
  m.palette_lightness_mid,
  m.palette_lightness_deep,
]

export interface MoodColorPickerProps {
  value: OkLch
  onChange: (lch: OkLch) => void
  disabled: boolean
}

export function MoodColorPicker({ value, onChange, disabled }: MoodColorPickerProps) {
  const ceiling = maxChromaInGamut(value.l, value.h)

  return (
    <View style={styles.picker}>
      <Text style={styles.title}>{m.palette_picker_title()}</Text>

      <Text style={styles.axis}>{m.palette_picker_hue()}</Text>
      <View style={styles.strip}>
        {Array.from({ length: HUE_SWATCHES }, (_, index) => {
          const hue = (index * 360) / HUE_SWATCHES
          return (
            <Swatch
              key={hue}
              lch={clampChromaToGamut({ ...value, h: hue })}
              selected={Math.round(value.h / (360 / HUE_SWATCHES)) % HUE_SWATCHES === index}
              disabled={disabled}
              onPress={onChange}
            />
          )
        })}
      </View>

      <Text style={styles.axis}>{m.palette_picker_chroma()}</Text>
      <View style={styles.strip}>
        {Array.from({ length: CHROMA_SWATCHES }, (_, index) => {
          const chroma = (ceiling * (index + 1)) / CHROMA_SWATCHES
          return (
            <Swatch
              key={chroma}
              lch={{ ...value, c: chroma }}
              selected={Math.abs(value.c - chroma) < ceiling / (CHROMA_SWATCHES * 2)}
              disabled={disabled}
              onPress={onChange}
            />
          )
        })}
      </View>

      <Text style={styles.axis}>{m.palette_picker_lightness()}</Text>
      <SegmentedControl
        ariaLabel={m.palette_picker_lightness()}
        disabled={disabled}
        value={String(nearestEmotionStep(value.l))}
        onValueChange={(next) => onChange(clampChromaToGamut({ ...value, l: Number(next) }))}
        items={EMOTION_LIGHTNESS_STEPS.map((step, index) => ({
          value: String(step),
          label: (LIGHTNESS_LABELS[index] ?? LIGHTNESS_LABELS[0])(),
        }))}
      />
    </View>
  )
}

function Swatch({
  lch,
  selected,
  disabled,
  onPress,
}: {
  lch: OkLch
  selected: boolean
  disabled: boolean
  onPress: (lch: OkLch) => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={m.palette_preset_label()}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => onPress(lch)}
      style={({ pressed }) => [
        styles.swatch,
        { backgroundColor: okLchToColor(lch) },
        selected && styles.selected,
        (pressed || disabled) && styles.dimmed,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  picker: { gap: 8 },
  title: { color: tokens.color.text, fontSize: tokens.fontSize.sm, fontWeight: '500' },
  axis: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs, marginTop: 4 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatch: {
    borderColor: tokens.color.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    width: 32,
  },
  selected: { borderColor: tokens.color.text, borderWidth: 2 },
  dimmed: { opacity: 0.6 },
})
