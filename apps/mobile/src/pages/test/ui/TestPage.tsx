import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { VALUES } from '@cosimosi/config'
import {
  DEFAULT_SKY_EFFECT,
  PostFX,
  SKY_EFFECTS,
  SkinProvider,
  SkySphere,
  StarField,
  UniverseCanvas,
  resolveSkyEffect,
  useSkin,
  type SkyEffectKey,
} from '@cosimosi/3d-renderer'
import { MAX_SHOWCASE_EMOTIONS, showcaseEmotions } from '@cosimosi/emotion'
import { useObservabilityFacade } from '@cosimosi/observability/react'
import { Button, tokens, useReducedMotion } from '@cosimosi/ui'

import { diagnosticsSurfaceFlag } from '../../../shared/config/index.ts'

// The on-device design showcase — the mobile mirror of the web /test surface's emotion-sky panel
// ([57]/job 39 T004). It proves the ONE shared TSL source on the React Native WebGPU canvas: the
// enclosing SkySphere, every react-bits-derived effect, and the emotion-count reshaping, inspected
// on real hardware. Reachable only while the diagnostics-surface flag is on (deep link `test`),
// like the diagnostics screen. Captions are demo data, intentionally outside the product i18n
// catalog (a dev-only surface, parity with web).
const T = {
  title: 'Emotion sky (3D)',
  unavailable: 'The test surface is not available in this build.',
  back: 'Back',
  countLabel: 'How many emotions',
}

export function TestPage({ onBack }: { onBack: () => void }) {
  const observability = useObservabilityFacade()
  const enabled = observability.getFeatureFlag(diagnosticsSurfaceFlag)
  if (!enabled) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.blurb}>{T.unavailable}</Text>
        <Button variant="text" color="neutral" onPress={onBack}>
          {T.back}
        </Button>
      </View>
    )
  }
  return (
    <SkinProvider defaultSkin="emotion">
      <SkyShowcase onBack={onBack} />
    </SkinProvider>
  )
}

// The showcase proper: the sky-sphere over the starfield with the skin's camera + bloom, and the
// effect/count switchers beneath. Switching an effect opens on its preferred emotion count (the
// count it reads best at); the count row then explores 1..N freely, exactly like the web panel.
function SkyShowcase({ onBack }: { onBack: () => void }) {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const [effectKey, setEffectKey] = useState<SkyEffectKey>(
    skin.background.type === 'sky' ? skin.background.props.effect : DEFAULT_SKY_EFFECT,
  )
  const active = resolveSkyEffect(effectKey)
  const [count, setCount] = useState<number>(active.defaultCount)
  const emotions = useMemo(() => showcaseEmotions(count), [count])

  return (
    <View style={styles.screen}>
      <View style={styles.canvas}>
        <UniverseCanvas dpr={[1, VALUES.rendering.maxPixelRatio]} fov={skin.camera.fov}>
          <SkySphere stops={emotions} effect={effectKey} reducedMotion={reducedMotion} />
          <StarField reducedMotion={reducedMotion} />
          <PostFX bloom={skin.bloom} />
        </UniverseCanvas>
      </View>
      <View style={styles.controls}>
        <View style={styles.header}>
          <Text style={styles.title}>{T.title}</Text>
          <Button variant="text" color="neutral" size="sm" onPress={onBack}>
            {T.back}
          </Button>
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
                  onPress={() => {
                    setEffectKey(entry.key)
                    setCount(entry.defaultCount)
                  }}
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
        <Text style={styles.countLabel}>{T.countLabel}</Text>
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
    </View>
  )
}

const styles = StyleSheet.create({
  blurb: { color: tokens.color['text-muted'], fontSize: 13 },
  canvas: { flex: 1 },
  chip: {
    borderColor: tokens.color.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chipSelected: { borderColor: tokens.color.primary },
  chipText: { color: tokens.color['text-subtle'], fontSize: 13 },
  chipTextSelected: { color: tokens.color.text, fontSize: 13 },
  controls: { backgroundColor: tokens.color.bg, gap: 12, padding: 16, paddingBottom: 32 },
  countLabel: { color: tokens.color['text-subtle'], fontSize: 12 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  screen: { backgroundColor: tokens.color.bg, flex: 1 },
  title: { color: tokens.color.text, fontSize: 16, fontWeight: '500' },
  unavailable: {
    alignItems: 'center',
    backgroundColor: tokens.color.bg,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
})
