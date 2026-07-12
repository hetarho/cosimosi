import { moodColor } from '@cosimosi/emotion'
import type { EpisodicMemory, Neuron } from '@cosimosi/memory'
import { effectiveBrightness, effectiveStrength } from '@cosimosi/memory-logic'
import { normalizeSeed } from '@cosimosi/universe'

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
}: {
  selection: { kind: 'episodic'; memory: EpisodicMemory } | { kind: 'neuron'; neuron: Neuron }
  // Reserved for forgetting-visuals: the read-time "now" that will drive effectiveElapsedDays [V2].
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
  // effectiveBrightness now carries the Epic-D forgetting fade, but this panel stays full (elapsed 0)
  // until forgetting-visuals binds the real effectiveElapsedDays/offset — the fade lands with no
  // panel change then (CC1).
  const brightness = effectiveBrightness(0, memory.emotion.arousal, strength)
  return (
    <div className="flex gap-4">
      <StarGlyph memory={memory} />
      <dl className="flex flex-1 flex-col gap-2">
        <MetaRow label={m.star_meta_emotion()} value={moodLabel(memory.emotion.mood)} />
        <MetaRow label={m.star_meta_brightness()} value={percent(brightness)} />
        <MetaRow label={m.star_meta_created()} value={memory.createdUniverseTime} />
        <MetaRow label={m.star_meta_strength()} value={strength.toFixed(2)} />
        <MetaRow label={m.star_meta_forgetting_state()} value={m.star_meta_forgetting_vivid()} />
      </dl>
    </div>
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
