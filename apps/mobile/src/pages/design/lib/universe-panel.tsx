import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { VALUES } from '@cosimosi/config'
import {
  PostFX,
  SKY_EFFECTS,
  SkinProvider,
  SkySphere,
  StarField,
  UniverseCanvas,
  resolveActiveSkin,
  resolveSkyEffect,
  useSkin,
  type SkyEffectKey,
} from '@cosimosi/3d-renderer'
import { MAX_SHOWCASE_EMOTIONS, showcaseEmotions } from '@cosimosi/emotion'
import { tokens, useReducedMotion } from '@cosimosi/ui'

import { Section, Specimen } from './showcase-shell.tsx'
import { T } from './showcase-copy.ts'

/**
 * The 3D half of the language, on the native showcase.
 *
 * It mirrors the web section rather than reimplementing it: the same recipes off the same TSL source,
 * so a difference between the two surfaces is a real parity finding and not two authors' idea of the
 * same sky. The frame budget is only real on a device, which is why this section exists at all.
 */
export function UniversePanel() {
  return (
    <Section title={T.universeTitle}>
      <Specimen label={T.skyLabel} note={T.skyNote}>
        <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
          <SkyStage />
        </SkinProvider>
      </Specimen>
    </Section>
  )
}

/** The count the section opens on — a review convenience, not a property of any sky. */
const OPENING_EMOTIONS = 5

function SkyStage() {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const [effectKey, setEffectKey] = useState<SkyEffectKey>(skin.sky.effect)
  const [count, setCount] = useState(OPENING_EMOTIONS)
  const active = resolveSkyEffect(effectKey)
  const emotions = useMemo(() => showcaseEmotions(count), [count])

  return (
    <View style={styles.stack}>
      <View style={styles.canvas}>
        <UniverseCanvas
          dpr={[1, VALUES.rendering.maxPixelRatio]}
          fov={skin.camera.fov}
          clearColor={skin.sky.night}
        >
          <SkySphere stops={emotions} effect={effectKey} reducedMotion={reducedMotion} />
          <StarField reducedMotion={reducedMotion} />
          <PostFX bloom={skin.bloom} />
        </UniverseCanvas>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {SKY_EFFECTS.map((entry) => {
            const selected = entry.key === effectKey
            return (
              <Pressable
                key={entry.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setEffectKey(entry.key)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                  {entry.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
      <Text style={styles.blurb}>{active.blurb}</Text>

      <Text style={styles.countLabel}>{T.skyCountLabel}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {Array.from({ length: MAX_SHOWCASE_EMOTIONS }, (_, i) => i + 1).map((n) => {
            const selected = n === count
            return (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setCount(n)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                  {String(n)}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  blurb: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  canvas: {
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    height: 320,
    overflow: 'hidden',
  },
  chip: {
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: tokens.spacing[2],
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chipSelected: { borderColor: tokens.color.primary },
  chipText: { color: tokens.color['text-subtle'], fontSize: tokens.fontSize.sm },
  chipTextSelected: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
  countLabel: { color: tokens.color['text-subtle'], fontSize: tokens.fontSize.xs },
  stack: { gap: 12 },
})
