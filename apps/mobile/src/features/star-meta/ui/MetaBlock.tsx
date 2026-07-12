import { StyleSheet, Text, View } from 'react-native'

import { moodColor } from '@cosimosi/emotion'
import type { EpisodicMemory, Neuron } from '@cosimosi/memory'
import { effectiveBrightness, effectiveStrength } from '@cosimosi/memory-logic'
import { tokens } from '@cosimosi/ui'
import { normalizeSeed } from '@cosimosi/universe'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

// RN fork of the web meta block (§3.5). The seed-driven glyph is drawn from the domain seed alone
// (no three): the normalized seed rounds + rotates a mood-tinted square so the same star always
// previews the same shape ([V5]).
function StarGlyph({ memory }: { memory: EpisodicMemory }) {
  const seed = normalizeSeed(memory.seed, memory.id)
  return (
    <View
      style={[
        styles.glyph,
        {
          backgroundColor: moodColor(memory.emotion.mood),
          borderRadius: 8 + Math.round(seed * 20),
          transform: [{ rotate: `${Math.round(seed * 360)}deg` }],
        },
      ]}
    />
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

// features/star-meta ([D1][I3]): episodic meta (shape · emotion · brightness · written date ·
// strength) vs neuron info-only with NO emotion. Every derived value is read from the shared
// read-time functions, none re-derived (A2) — identical logic to the web fork.
export function MetaBlock({
  selection,
}: {
  selection: { kind: 'episodic'; memory: EpisodicMemory } | { kind: 'neuron'; neuron: Neuron }
  // Reserved for forgetting-visuals: the read-time "now" that will drive effectiveElapsedDays [V2].
  universeTime: string | null
}) {
  if (selection.kind === 'neuron') {
    const { neuron } = selection
    return (
      <View style={styles.list}>
        <MetaRow
          label={m.star_meta_neuron_name()}
          value={neuron.name ?? m.star_meta_neuron_unnamed()}
        />
        <MetaRow label={m.star_meta_neuron_type()} value={neuronTypeLabel(neuron.neuronType)} />
        <MetaRow label={m.star_meta_neuron_connectivity()} value={String(neuron.connectivity)} />
      </View>
    )
  }

  const { memory } = selection
  const strength = effectiveStrength(memory.baseStrength, memory.recallCount)
  // effectiveBrightness now carries the Epic-D forgetting fade, but this panel stays full (elapsed 0)
  // until forgetting-visuals binds the real effectiveElapsedDays/offset — identical to the web fork.
  const brightness = effectiveBrightness(0, memory.emotion.arousal, strength)
  return (
    <View style={styles.episodic}>
      <StarGlyph memory={memory} />
      <View style={styles.list}>
        <MetaRow label={m.star_meta_emotion()} value={moodLabel(memory.emotion.mood)} />
        <MetaRow label={m.star_meta_brightness()} value={percent(brightness)} />
        <MetaRow label={m.star_meta_created()} value={memory.createdUniverseTime} />
        <MetaRow label={m.star_meta_strength()} value={strength.toFixed(2)} />
        <MetaRow label={m.star_meta_forgetting_state()} value={m.star_meta_forgetting_vivid()} />
      </View>
    </View>
  )
}

function neuronTypeLabel(type: Neuron['neuronType']): string {
  if (type === 'semantic') return m.star_meta_neuron_type_semantic()
  if (type === 'spatial') return m.star_meta_neuron_type_spatial()
  return m.star_meta_neuron_type_entity()
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

const styles = StyleSheet.create({
  episodic: { flexDirection: 'row', gap: tokens.spacing[4] },
  list: { flex: 1, gap: tokens.spacing[2] },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: tokens.spacing[4] },
  label: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  value: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
  glyph: { width: 64, height: 64 },
})
