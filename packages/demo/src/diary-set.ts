import type { Mood } from '@cosimosi/emotion'
import type { Locale } from '@cosimosi/i18n'
import type { NeuronType } from '@cosimosi/memory'

import type { DemoScenario } from './scenario.ts'

// The shipped demo content ([Z4][Z5]): three diaries designed together so their memories reuse
// neurons, because the only things that can pull memories together are a shared neuron and synapse
// strength — three diaries drawn independently would settle as three unrelated clumps and the
// demo's fourth beat would show nothing ([I4][L2]).
//
// A set splits into two halves that are authored and reviewed differently: `structure` holds
// locale-free domain facts reviewed against [I3]/[I4]/[I6], `text` holds public copy reviewed
// against [I12]. The text half is keyed by `Locale`, which is the completeness guard — a `.ts`
// data module is outside `lint:raw-strings`' reach, so the type has to carry that duty.
//
// The whole shape is deliberately INCAPABLE of holding a derived value: there is no field for a
// coordinate [I5], EffectiveBrightness, EffectiveStrength, decay depth, a stage-at-a-time, an
// accessibility weight, a Twinkle amount or an ornament price. A second TypeScript copy of the
// domain math would have nowhere to write its output (the answer to [Z6]), and [Z8] holds by
// construction: no price can render on the demo because none exists in the data.

export interface DemoNeuron {
  readonly id: string
  readonly neuronType: NeuronType
}

export interface DemoActivation {
  readonly neuronId: string
  readonly weight: number
}

export interface DemoMemory {
  readonly id: string
  readonly mood: Mood
  readonly intensity: number
  readonly activations: readonly DemoActivation[]
  /** Visual form/anchor hint [E7], a literal int64 — never a coordinate [I5]. */
  readonly seed: bigint
}

export interface DemoDiary {
  readonly id: string
  /** Integer days from the set's own start. Absolute dates are stamped from the resolver's epoch,
   *  so a fixture authored in 2026 does not show a 2029 visitor a stale universe. */
  readonly dayOffset: number
  readonly memories: readonly DemoMemory[]
}

// Authored rather than computed: synapse formation (`memory/link.go`) has no TS mirror, and a
// fourth mirrored function can drift where a fixture row cannot. The integrity suite is the guard
// — canonical ordering [I6], both endpoints co-firing in some memory [I4], and a strength inside
// the production band so the link layer reads at the scale it does in the real universe.
export interface DemoSynapse {
  readonly id: string
  readonly neuronAId: string
  readonly neuronBId: string
  readonly strength: number
  readonly coActivationCount: number
  readonly lastActivatedDayOffset: number
}

/** Three, because two cannot demonstrate reuse and four dilute the beat. The count is this tuple's
 *  arity — a length of a content array is not a tuning number, so it claims no values key. */
export type DemoDiaryTriple<T> = readonly [T, T, T]

export interface DemoDiarySetStructure {
  readonly id: string
  readonly neurons: readonly DemoNeuron[]
  readonly diaries: DemoDiaryTriple<DemoDiary>
  /** The free-play pool beyond the tutorial triple ([Z4] as amended by change 10): drawn one at a
   *  time by `pickDemoDiary` so a visitor can keep writing past the tutorial. Non-empty by type, so
   *  every set sustains free play; authored against the SAME neuron roster, because a diary that
   *  shares nothing would settle as an unrelated clump ([I4][L2]). */
  readonly extraDiaries: readonly [DemoDiary, ...DemoDiary[]]
  readonly synapses: readonly DemoSynapse[]
  /** Declared, then PROVEN by the integrity suite — the beat-4 precondition. */
  readonly sharedNeuronIds: readonly [string, ...string[]]
}

export interface DemoMemoryText {
  readonly name: string
  readonly currentText: string
  /** The gist ladder, stage 1..SEMANTIC_MAX_STAGE — precomputed, so nothing consumes gist units
   *  and no `ViewSemantic` read is ever issued ([Z1][Z5]). */
  readonly semanticStages: readonly string[]
  /** Word-loss texts for stages 1..N, N = `forgetting.stage_word_removal_ratios`' length. Stage 0
   *  is `currentText` itself. Stored facts in production too — the client never redacts. */
  readonly decayStages: readonly string[]
  /** How the memory reads after it has been recalled once — the same scene, come back a little
   *  changed [I8]. Present only on a set's recall target, because that is the only memory any
   *  scenario reconsolidates; the integrity suite proves the target has one. */
  readonly reconsolidatedText?: string
}

export interface DemoDiaryText {
  /** Rendered verbatim and never rewritten [I2][D4]. */
  readonly body: string
  readonly memories: Readonly<Record<string, DemoMemoryText>>
}

export interface DemoDiarySetText {
  readonly diaries: Readonly<Record<string, DemoDiaryText>>
  readonly neuronNames: Readonly<Record<string, string>>
}

export interface DemoDiarySet {
  readonly structure: DemoDiarySetStructure
  readonly text: Readonly<Record<Locale, DemoDiarySetText>>
  readonly scenario: DemoScenario
}
