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

**Palette registry + per-mood preference (plan 51).** `registry.ts` exposes complete first-party
`MoodPalette` tables under stable ids as authored recommendation/content sets. The legacy
`palette_preferences.palette_id` contract remains compatible but is not the missing-row fallback.
`mood_colors` optionally overrides individual moods; `resolveMoodColors(rows)` overlays them on
`cosimosi-default`, and `applyMoodColors` sends the complete table through the unchanged
`setMoodPalette` seam. Web and mobile app-layer gates wait for the preference reads before releasing
palette-dependent children. Live writes recolor through that seam without `GetUniverse`.

`oklab.ts` owns sRGB ↔ OkLab/OkLCH conversion, OkLab ΔE, and hue-bucket projection.
`mood-color.ts` owns lightness snapping, near-duplicate detection, and partial-row overlay.
`preference/mood-colors.ts` owns account DTO parsing, recommendations, and the apply operation;
`use-mood-color-editor.ts` owns optimistic apply and rollback. The account context ports the
server-authoritative snap/bucket subset to Go, with `mood-color-parity.json` pinning TypeScript and
Go outputs. This color arithmetic is golden-parity because the server stores its result; rendering
itself remains frontend-only.

The coarse axis check is still pure and warn-only. The per-mood OkLab near-duplicate check is also
warn-only. Generated `palette.*` values own recommendation count, sample floor, bucket width,
near-neutral chroma, duplicate ΔE, onboarding field radius, and the existing axis threshold. Color
tables and formulas stay code/content.

The explicit `@cosimosi/emotion/i18n` seam owns `moodLabel(wireMood)`: its exhaustive mood-to-message
projection falls back to neutral for an unknown DTO value, and app `shared/i18n` barrels re-export
it without a web/mobile copy.

### 3.1 The per-day representative mood ([D12])

The diary calendar collapses a day's emotions to **one** mood for its mark, and it does so with the existing
field projection rather than a second color model: `dayRepresentativeMood(rows)` in
`packages/universe/src/diary-calendar.ts` is `toEmotionSlices(Map<Mood, weight>)[0]?.mood ?? null` — the **top
slice**, inheriting that function's `weight desc, mood.localeCompare` tie-break and its drop-≤0 normalization.
So a day's color is the same strength-weighted blend a backdrop paints ([M4]), reduced to its loudest emotion;
it is never an average and never a per-diary representative.

Three seam rules hold, and they are the reason this lives beside the palette rules rather than in the widget:

- **The weight arrives on the wire.** `DiaryDayMoodDto` carries `mood` (bare enum name) + `weight`, where the
  weight is `EffectiveStrength`-derived **server-side**. The client sums duplicate `(day, mood)` rows and
  normalizes through `toEmotionSlices`; it applies no decay and recomputes no strength ([V3]).
- **No color crosses the wire, and none enters the pure layer.** `DayMark` is `{ mood: Mood | null }` with no
  `color` field — `dayRepresentativeMood` deliberately discards the slice's resolved `color`, and the widget
  calls `moodColor` at render time. A palette swap therefore recolors the calendar with no code change ([M6]).
- **An unknown mood coerces to absence, not to a color.** An unrecognized `mood` string cannot key the
  `Map<Mood, number>` and so drops out, which yields `null` → the border-token outline. `NEUTRAL`'s hue is
  never used to stand in for "unknown" or for "nothing survives" ([M3]) — the same unknown→default discipline
  as `resolvePaletteById`.

`mood: null` means **written, but holding no live mood** (launched nothing, or all memories let go) and is
distinct from a day absent from the mark map, which was never written. The projection is presentation-only and
has **no Go twin**: the server never renders a calendar, and `toEmotionSlices` is unmirrored by rule.

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
