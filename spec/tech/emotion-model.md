# tech: emotion model

> As-built rules for the `Emotion` value object, the `@cosimosi/emotion` package, and TS↔Go arousal-strength parity.
> Plan [17](../plan/17.emotion-model.md) owns the product behavior.

## 1. Domain Ownership

`apps/api/internal/memory` owns the canonical emotion domain names:

- `Mood` is the fixed 13-value enum: `JOY`, `CALM`, `SAD`, `ANGER`, `FEAR`, `LOVE`, `NEUTRAL`, `EXCITEMENT`,
  `GRATITUDE`, `RELIEF`, `STRESS`, `TIRED`, `EMPTINESS`.
- `Emotion` is a value object on `EpisodicMemory`, with `{ Mood, Valence, Arousal, Intensity }`.
- `MoodQuadrant` and `MoodCoordinate` are pure domain helpers. Quadrants live in code; concrete coordinates come from
  generated values.

The domain package imports generated config only from `internal/platform/values`. It imports no sqlc, pgx, proto, JSON,
or DB representation type.

## 2. Generated Values

`spec/values.yaml` owns the emotion tuning scalars:

- `emotion.mood_valence`
- `emotion.mood_arousal`
- `emotion.arousal_strength_min = 0.35`
- `emotion.arousal_strength_max = 0.75`
- `emotion.default_intensity = 0.7`

`pnpm gen:values` mirrors those into `packages/config/src/values.gen.ts` and
`apps/api/internal/platform/values/values_gen.go`.

The mood enum, quadrant table, color palette, and arousal-to-strength formula are code/content and stay out of
`values.yaml`.

## 3. Palette Seam

`packages/emotion` is the pure cross-app mirror package. It exports the `Mood` union, the `Emotion` type,
`moodCoordinate`, `arousalToInitialStrength`, and the single mood color entry point:

```ts
moodColor(mood: Mood): Color
```

`moodColor` reads the active palette through the package seam. Rendering consumers import this function instead of a
palette table. A substitute palette is supplied as `Record<Mood, Color>` through `setMoodPalette`; the seam takes only a
`Mood` and returns only a `Color`, so it cannot write back to emotion facts or feed layout, strength, or synapse logic.

**Palette registry + per-user preference (plan 51).** `packages/emotion/registry.ts` exposes a named registry —
`PALETTES: Record<id, MoodPalette>` (≥2, each passing `assertCompletePalette`), `paletteById(id)` (unknown → default,
fail-safe), `listPalettes()`, `DEFAULT_PALETTE_ID = 'cosimosi-default'` — the count is a derived array length, never a
values scalar. `axis-consistency.ts` adds a pure `checkPaletteAxisConsistency(palette)` that warns (never blocks) when a
color's hue-derived warm/cool reading contradicts `moodCoordinate(mood).valence` beyond
`values.palette.axis_warn_valence_threshold`; every shipped palette returns no warnings. The per-user choice is a single
`palette_id` scalar owned by the new `internal/account` context (`account.v1.AccountService`, `palette_preferences`
table) — the read coerces an unset/retired id to the default, the write accepts only a first-party allow-list id (kept
byte-identical to the TS registry ids via a shared fixture), and the backend computes no color. An app-layer bootstrap
reads the preference on boot and applies it through `setMoodPalette` before the universe settles; a swap re-colors live
(a palette-version signal remounts the color layers) with no `GetUniverse` refetch and no rendering-package edit. The
registry + preference are frontend-owned (not golden-parity); the backend holds only the id.

## 4. Arousal Strength Parity

Go `memory.ArousalToInitialStrength(arousal float64)` and TS `arousalToInitialStrength(arousal)` implement the same
linear formula over the generated `[emotion.arousal_strength_min, emotion.arousal_strength_max]` bounds.

The canonical fixture is `packages/emotion/fixtures/arousal-strength.golden.json`. The Go test reads the checked-in
mirror at `apps/api/internal/memory/testdata/arousal-strength.golden.json` because the API Docker gate mounts only
`apps/api`. The TS test asserts the two files are byte-identical, and both implementations must match the fixture.

## 5. Guards

Adding or removing a mood requires changing the Go enum, the TS `Mood` union, `emotion.mood_valence`, and
`emotion.mood_arousal` together.

The TS package has a type-level exact-key assertion for generated value maps. The Go tests assert the 13 mood constants,
generated map keys, quadrant signs, and golden arousal-strength outputs.
