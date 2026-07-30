// The fixed ten-beat feed ([Z3]) expressed without importing the engine that will consume it:
// this package lands before the sequence engine, and the engine must stay host-agnostic anyway.
// A beat id is an IDENTIFIER UNION, not a new domain noun — the engine-side noun is `SequenceStep`
// and the data-side noun is `DemoDiarySet`, so one concept keeps one name.
//
// What a scenario deliberately does NOT carry: copy, an i18n key, a highlight target, a dwell time,
// an engine type, a price and any achievement data. Captions and highlights belong to the engine
// and each beat's effect on demo-local state belongs to the page.

export const DEMO_BEAT_IDS = [
  'diary_appears',
  'split',
  'launch',
  // What the visitor DOES at this beat is add the diaries whose memories reuse a neuron; what the
  // renderer makes of it is the emergent cluster. The domain half owns the id, because a rendering
  // word in a domain package is the drift `lint:language` exists to stop (§3.4).
  'neuron_reuse',
  'time_accelerates',
  'recall',
  'gist_rise',
  'color',
  'ornament_taster',
  'signup_cta',
] as const

export type DemoBeatId = (typeof DEMO_BEAT_IDS)[number]

// Beat 9 tastes one catalog ornament per kind. `kind` is a plain string rather than
// `@cosimosi/store`'s `OrnamentKind` because [I13] closes this package's dependency list at four
// domain packages; the page pins the pairing against the real union where it applies the taste.
// Only ids travel — no price, no acquisition path, no ownership ([Z8]).
export interface DemoOrnamentTaste {
  readonly kind: string
  readonly ornamentId: string
}

export interface DemoScenario {
  /** The ten [Z3] beats in order. */
  readonly beats: readonly DemoBeatId[]
  /** Beat 1 — the diary that appears first. */
  readonly firstDiaryId: string
  /** Beat 6 — the memory the visitor recalls; its mood differs from the set's dominant one, so
   *  beat 8's colour shift is visible ([M4][M5]). */
  readonly recallMemoryId: string
  /** Beat 7 — the memory that rises into the neocortex band. */
  readonly gistRiseMemoryId: string
  /** Beat 9 — one taste per catalog kind. */
  readonly ornamentTastes: readonly DemoOrnamentTaste[]
}
