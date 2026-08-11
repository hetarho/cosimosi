import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { EpisodicMemory, Neuron } from '@cosimosi/memory'
import {
  effectiveBrightness,
  effectiveElapsedDays,
  effectiveStrength,
} from '@cosimosi/memory-logic'
import { tokens, useReducedMotion } from '@cosimosi/ui'
import { currentDecayStage } from '@cosimosi/universe'
import { StarPreview } from '@cosimosi/universe-render'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

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
  shape,
  previewAction,
}: {
  selection: { kind: 'episodic'; memory: EpisodicMemory } | { kind: 'neuron'; neuron: Neuron }
  // The read-time "now" that drives the forgetting fade + current decay stage [V2][F1].
  universeTime: string | null
  /** The `STAR_SHADER` ornament this universe wears, so the panel's star is the one in the sky. */
  shape?: string
  /** A corner of the preview frame the composing widget may put a control in. This block reserves
   *  the position and never fills it — a read feature owns no action ([I11]). */
  previewAction?: ReactNode
}) {
  // Read above the neuron branch, because a hook cannot sit behind an early return. A neuron shows
  // no star, so it simply goes unused there.
  const reducedMotion = useReducedMotion()

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
    // The star above, what is known about it below — the same stack the web fork uses: side by side
    // the star is a thumbnail beside a table, stacked it is the subject and the rows are its caption.
    <View style={styles.episodic}>
      {/* The clipped frame holds the star; the action rides a wrapper OUTSIDE it, because a control
          inside the clip would be cut off at the corner it sits in. */}
      <View style={styles.previewFrame}>
        <View style={styles.preview}>
          <StarPreview
            memory={memory}
            universeTime={universeTime}
            shape={shape}
            reducedMotion={reducedMotion}
          />
        </View>
        {previewAction ? <View style={styles.previewAction}>{previewAction}</View> : null}
      </View>
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
  episodic: { gap: tokens.spacing[4] },
  previewFrame: { position: 'relative' },
  previewAction: { position: 'absolute', top: tokens.spacing[2], right: tokens.spacing[2] },
  // Rounded and clipped so the sky the star sits in reads as a window, not a hole.
  preview: {
    height: 176,
    overflow: 'hidden',
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  list: { gap: tokens.spacing[2] },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: tokens.spacing[4] },
  label: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  value: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
})
