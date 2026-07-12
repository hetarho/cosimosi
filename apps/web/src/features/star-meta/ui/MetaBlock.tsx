import { moodColor } from '@cosimosi/emotion'
import type { EpisodicMemory, Neuron } from '@cosimosi/memory'
import {
  effectiveBrightness,
  effectiveElapsedDays,
  effectiveStrength,
} from '@cosimosi/memory-logic'
import { currentDecayStage, normalizeSeed } from '@cosimosi/universe'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

// A seed-driven star-body preview from the domain seed alone (§3.4 — no three import): the
// normalized seed rounds + rotates a mood-tinted glyph so the same star always previews the same
// shape ([V5]). It is the panel's flat stand-in for the renderer's 3D body, not a second body.
function StarGlyph({ memory }: { memory: EpisodicMemory }) {
  const seed = normalizeSeed(memory.seed, memory.id)
  const rounding = 30 + Math.round(seed * 40)
  return (
    <div
      aria-hidden
      className="size-16 shrink-0 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
      style={{
        background: moodColor(memory.emotion.mood),
        borderRadius: `${rounding}% ${100 - rounding}% ${rounding}% ${100 - rounding}%`,
        transform: `rotate(${Math.round(seed * 360)}deg)`,
      }}
    />
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  )
}

// features/star-meta ([D1]): the read-only meta block. An episodic (big) star shows shape ·
// emotion color · brightness · 작성일 · 강도 · current forgetting state; a neuron (small) star
// shows info only, with NO emotion ([I3]). Every derived value is read from the shared read-time
// functions (starChannels/effectiveStrength/effectiveBrightness) — none re-derived here (A2).
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
      <dl className="flex flex-col gap-2">
        <MetaRow
          label={m.star_meta_neuron_name()}
          value={neuron.name ?? m.star_meta_neuron_unnamed()}
        />
        <MetaRow label={m.star_meta_neuron_type()} value={neuronTypeLabel(neuron.neuronType)} />
        <MetaRow label={m.star_meta_neuron_connectivity()} value={String(neuron.connectivity)} />
      </dl>
    )
  }

  const { memory } = selection
  const strength = effectiveStrength(memory.baseStrength, memory.recallCount)
  // The real read-time forgetting state: the brightness fade and the decay stage share the same
  // offset-inclusive elapsed clock, so this "현재 망각 정도" indicator moves with the star's dimming
  // ([F1][V2]). Recall resets the anchors, so the next read reads full/vivid again ([F5]).
  const elapsed = effectiveElapsedDays(
    universeTime,
    memory.lastRecalledUniverseTime,
    memory.createdUniverseTime,
    memory.forgettingOffsetDays,
  )
  const brightness = effectiveBrightness(elapsed, memory.emotion.arousal, strength)
  const stage = currentDecayStage(memory, universeTime)
  return (
    <div className="flex gap-4">
      <StarGlyph memory={memory} />
      <dl className="flex flex-1 flex-col gap-2">
        <MetaRow label={m.star_meta_emotion()} value={moodLabel(memory.emotion.mood)} />
        <MetaRow label={m.star_meta_brightness()} value={percent(brightness)} />
        <MetaRow label={m.star_meta_created()} value={memory.createdUniverseTime} />
        <MetaRow label={m.star_meta_strength()} value={strength.toFixed(2)} />
        <MetaRow label={m.star_meta_forgetting_state()} value={forgettingStageLabel(stage)} />
      </dl>
    </div>
  )
}

function neuronTypeLabel(type: Neuron['neuronType']): string {
  if (type === 'semantic') return m.star_meta_neuron_type_semantic()
  if (type === 'spatial') return m.star_meta_neuron_type_spatial()
  return m.star_meta_neuron_type_entity()
}

// The forgetting-degree label for a decay stage (0 = vivid). Stages deepen the fade word; the value
// array is [F9]-tunable, so clamp past the last known label rather than assuming a fixed count.
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
