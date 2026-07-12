import { StyleSheet, Text, View } from 'react-native'

import { moodColor } from '@cosimosi/emotion'
import type { EpisodicMemory, Neuron } from '@cosimosi/memory'
import {
  effectiveBrightness,
  effectiveElapsedDays,
  effectiveStrength,
} from '@cosimosi/memory-logic'
import { tokens } from '@cosimosi/ui'
import { currentDecayStage, normalizeSeed } from '@cosimosi/universe'

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
  universeTime,
}: {
  selection: { kind: 'episodic'; memory: EpisodicMemory } | { kind: 'neuron'; neuron: Neuron }
  // The read-time "now" that drives the forgetting fade + current decay stage [V2][F1].
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
  // The real read-time forgetting state: brightness fade and decay stage share the same
  // offset-inclusive elapsed clock, so the "현재 망각 정도" indicator moves with the star's dimming
  // ([F1][V2]); recall resets the anchors so the next read reads full/vivid ([F5]). Identical to web.
  const elapsed = effectiveElapsedDays(
    universeTime,
    memory.lastRecalledUniverseTime,
    memory.createdUniverseTime,
    memory.forgettingOffsetDays,
  )
  const brightness = effectiveBrightness(elapsed, memory.emotion.arousal, strength)
  const stage = currentDecayStage(memory, universeTime)
  return (
    <View style={styles.episodic}>
      <StarGlyph memory={memory} />
      <View style={styles.list}>
        <MetaRow label={m.star_meta_emotion()} value={moodLabel(memory.emotion.mood)} />
        <MetaRow label={m.star_meta_brightness()} value={percent(brightness)} />
        <MetaRow label={m.star_meta_created()} value={memory.createdUniverseTime} />
        <MetaRow label={m.star_meta_strength()} value={strength.toFixed(2)} />
        <MetaRow label={m.star_meta_forgetting_state()} value={forgettingStageLabel(stage)} />
      </View>
    </View>
  )
}

function neuronTypeLabel(type: Neuron['neuronType']): string {
  if (type === 'semantic') return m.star_meta_neuron_type_semantic()
  if (type === 'spatial') return m.star_meta_neuron_type_spatial()
  return m.star_meta_neuron_type_entity()
}

// The forgetting-degree label for a decay stage (0 = vivid); clamps past the last known label since
// the stage-ratio array is [F9]-tunable. Mirrors the web fork.
function forgettingStageLabel(stage: number): string {
  const labels = [
    m.star_meta_forgetting_vivid(),
    m.star_meta_forgetting_softening(),
    m.star_meta_forgetting_blurring(),
    m.star_meta_forgetting_faint(),
    m.star_meta_forgetting_distant(),
  ]
  const index = Math.min(Math.max(stage, 0), labels.length - 1)
  return labels[index]
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
