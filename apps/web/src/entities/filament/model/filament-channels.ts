import { VALUES } from '@cosimosi/config'
import { effectiveSynapseStrength, elapsedUniverseDays } from '@cosimosi/memory-logic'

import type { Synapse } from '../../synapse/@x/filament.ts'

// The pure projection of a synapse onto its fat-line body (§3.4). Width and brightness both
// track EffectiveSynapseStrength — the read-time decayed strength from the stored base +
// last-activated universe time (golden-parity with the Go domain) [V6]. A stronger
// synapse draws a thicker, brighter line. Endpoints (neuron ids → buffer slots) are resolved
// in the ui, structurally excluding a star↔star line [I4][I6].
export interface FilamentChannels {
  /** Half-width in world units, within [filamentWidthMin, filamentWidthMax]. */
  readonly width: number
  /** Glow 0..1, within [filamentBrightnessMin, filamentBrightnessMax]. */
  readonly brightness: number
  /** Ribbon color, linear RGB 0..1 = tint × brightness (additive, so dim synapses barely glow). */
  readonly color: readonly [number, number, number]
}

// A cool, emotion-neutral line color (linear RGB) — content, not config; a filament carries a
// synapse's strength, never an emotion [I3]. Brightness scales it for the additive glow.
const FILAMENT_TINT: readonly [number, number, number] = [0.36, 0.52, 0.82]

export function filamentChannels(synapse: Synapse, universeTime: string | null): FilamentChannels {
  const { rendering } = VALUES
  const elapsed = elapsedUniverseDays(synapse.lastActivatedUniverseTime, universeTime)
  const effective = effectiveSynapseStrength(synapse.strength, elapsed)
  const width = lerpClamp(rendering.filamentWidthMin, rendering.filamentWidthMax, effective)
  const brightness = lerpClamp(rendering.filamentBrightnessMin, rendering.filamentBrightnessMax, effective)
  return {
    width,
    brightness,
    color: [FILAMENT_TINT[0] * brightness, FILAMENT_TINT[1] * brightness, FILAMENT_TINT[2] * brightness],
  }
}

/** A synapse batch flattened to the layer's buffers: endpoint neuron slots + per-edge channels. */
export interface FilamentBatch {
  /** Flat [a0, b0, a1, b1, …] endpoint neuron slots (stride-2 per edge). */
  readonly endpointPairs: Uint32Array
  /** Per-edge half-width (stride 1). */
  readonly widths: Float32Array
  /** Per-edge ribbon color (stride 3, rgb). */
  readonly colors: Float32Array
  readonly count: number
}

// Project synapses to the batched fat-line buffers. A synapse is kept only when BOTH of its
// neurons have a coordinate slot, and its endpoints are those two neuron slots — so a filament
// is structurally always neuron↔neuron, never star↔star [I4][I6]. The neuron-only index map
// carries no memory slots, so a memory can never become an endpoint.
export function projectFilaments(
  synapses: readonly Synapse[],
  neuronIndexById: Readonly<Record<string, number>>,
  universeTime: string | null,
): FilamentBatch {
  const pairs: number[] = []
  const widths: number[] = []
  const colors: number[] = []
  for (const synapse of synapses) {
    const a = neuronIndexById[synapse.neuronAId]
    const b = neuronIndexById[synapse.neuronBId]
    if (a === undefined || b === undefined) continue
    const channel = filamentChannels(synapse, universeTime)
    pairs.push(a, b)
    widths.push(channel.width)
    colors.push(channel.color[0], channel.color[1], channel.color[2])
  }
  return {
    endpointPairs: Uint32Array.from(pairs),
    widths: Float32Array.from(widths),
    colors: Float32Array.from(colors),
    count: widths.length,
  }
}

// Map a read-time value into a visual range; a non-finite input (from a skewed/corrupt DTO
// field the domain mapper didn't coerce) floors to `min` rather than producing a NaN width /
// color that would poison the ribbon vertices.
function lerpClamp(min: number, max: number, t: number): number {
  const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0
  return min + (max - min) * clamped
}
