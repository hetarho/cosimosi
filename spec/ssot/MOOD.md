# MOOD emotion & colour
> r1 | the one primary emotion each EpisodicMemory carries, the mood → colour projection that is its only colour, and the per-mood colour preference a user edits for free

## decisions
- MOOD-1 [o] every `EpisodicMemory` carries exactly one primary emotion, the value object `Emotion {mood, valence, arousal, intensity}`; it is a field of the memory, never an aggregate of its own
  - it is stored as columns on `episodic_memories`, never as a table of its own →~MEM
  - a diary split into N memories yields N independent emotions; each scene may carry a different mood
  - the split proposes a mood per memory →=ENC; the writer may change it in the write session →=WRITE-2
  - write-once at launch: no path rewrites a launched memory's `mood`, `valence`, `arousal` or `intensity` (not recall, reconsolidation, consolidation, release or restore) →~WRITE-4
  - `valence` and `arousal` are stored on `episodic_memories` as a launch-time snapshot of the mood's coordinate ← a later coordinate revision must not move or recolour memories already launched
  - `intensity` is `emotion.default_intensity` at launch, stored and carried on `EmotionDto`; nothing reads it (no colour, strength, layout or field weight): a reserved field
  - a gist keeps its memory's emotion and colour through every rise →=CONSOL-17
- MOOD-2 [o] the mood vocabulary is a closed enum of 13 moods placed on the (valence × arousal) plane: four quadrants of three plus neutral ← Russell 1980 circumplex →~SCI
  | quadrant | moods |
  |---|---|
  | high-arousal positive (V+ A+) | `JOY`, `EXCITEMENT`, `LOVE` |
  | low-arousal positive (V+ A−) | `CALM`, `GRATITUDE`, `RELIEF` |
  | high-arousal negative (V− A+) | `ANGER`, `FEAR`, `STRESS` |
  | low-arousal negative (V− A−) | `SAD`, `TIRED`, `EMPTINESS` |
  | neutral | `NEUTRAL` |
  - coordinates per mood: `emotion.mood_valence` (−1..1) and `emotion.mood_arousal` (0..1); the quadrant table is code (`moodCatalog` in `internal/memory/emotion.go`, `MOOD_QUADRANTS` in `packages/emotion`)
  - one name in every layer: Go `memory.Mood`, the `mood` TEXT column, proto as the bare enum name string (`"JOY"`, never a proto enum or a number), the TS `Mood` union
  - emotion axes enter downstream math only through `MoodCoordinate(mood)` (TS `moodCoordinate`)
  - a mood outside the enum is refused by the domain at split (`ErrEncodeInvalidSplit`) and at launch (`ErrLaunchInvalidMemories`); `episodic_memories.mood` has no DB CHECK →=ENC
  - adding or removing a mood changes together: both Go enums (memory, account), the TS union, both values maps, the `mood_colors` and `mood_color_counts` CHECK lists, the `mood_*` i18n labels and both authored colour tables
  - guards: Go tests pin the 13 constants, the values keys and the quadrant signs; the TS package asserts exact keys of the generated maps at type level
  - display label: `moodLabel(wireMood)` (`@cosimosi/emotion/i18n`) maps to the `mood_*` keys; an unknown wire value shows the neutral label, never a raw enum token
- MOOD-3 [o] a star's colour is its memory's primary mood, `moodColor(memory.mood)`, and colour is bound to emotion alone →!INV-3
  - every meaning-bearing body colours through the one seam: the episodic star, its nebula bleed, the gist star →=VIS-4
  - a neuron carries information, not feeling: the cell-star has no emotion colour →=VIS
  - the layer-gap haze is a neutral space tone outside the seam →=CONSOL-18
  - decorative backdrop motes never read emotion and never stand for one; a decorative sky effect only shades the emotion sky, whose colours and shares stay this domain's →~DECOR-4
  - absence of a feeling is never a feeling: an unknown mood, or a diary with no live memory, renders as absence (outline, no dot), never in `NEUTRAL`'s colour →~DIARY-12
  - no colour crosses the wire: memory, diary and calendar DTOs carry the bare mood name, the encode schema has no colour field (→=WRITE-8), and clients map through `moodColor` at render
  - a stored client projection keeps the mood, never a resolved colour, so a palette change recolours every surface without a code change
- MOOD-4 [o] the universe's colour is the strength-weighted sum of its memories' emotions, painted as many coexisting colours spreading in proportion, never one average colour →~VIS-4
  - the rendering of the field, the bleed radius and the sky gradient →=VIS
  - each memory bleeds its mood colour around itself, deeper near the star and wider the stronger it is; the weight is the memory's read-time `EffectiveStrength` →~VIS-3
  - the global tone is emergent: no "universe colour" value is stored, modelled or shown (no product readout, no dev overlay), as positions emerge from synapses
  - one weighting for every colour surface: `universeEmotionSlices` (`packages/universe`) sums `effectiveStrength(baseStrength, recallCount)` per mood into `toEmotionSlices` ← two surfaces must never disagree on what one memory is worth
  - `toEmotionSlices`: drops weights ≤ 0, normalizes to sum 1, orders by weight then mood name; the emotion sky and the landing walkthrough read it, and the nebula bleeds by the same `EffectiveStrength`
  - a representative mood for a group of memories (a calendar day) is the top slice of that projection, never a count or an average; the weights arrive server-computed →=DIARY-12
  - the weighting is a visualization output only: it changes pixels, never the force-sim, clustering, synapse strength or position →!MOOD-7
- MOOD-5 [o] the universe's colour mirrors the feelings the user keeps re-reading, not the average of what they wrote: a recall raises a memory's strength and so its colour's share →~RECALL-3
  - a memory count per mood is never a colour weight: it would be exactly the average this rule denies →!MOOD-4
  - telling the user is mandatory and is owned by the landing walkthrough's fixed last step (`landing_walk_mirror_*`) →=MKT-1 and the demo's colour beat (`demo_beat_color`) →=DEMO
  - the universe screen carries no device explaining this definition ← on the screen made for looking at the field, the explanation competes with the field
- MOOD-6 [o] every emotion colour comes from one entry point, `moodColor(mood): Color` (`packages/emotion`), over one replaceable complete palette; rendering code is palette-agnostic →!INV-11
  - `setMoodPalette(palette)` swaps the whole table (asserted complete over the 13 moods) and `resetMoodPalette()` restores the authored default; nothing else writes the active palette
  - the seam takes only a `Mood` and returns only a `Color`: memory identity, diary content, position, strength and synapse state are never colour inputs, and nothing it returns feeds layout, strength, connection or forgetting
  - consumers that cache colours recompute on `paletteVersion()` or `subscribeMoodPalette` (layer keys) and never remount the renderer →=VIS
  - no slice, package, shader or 2D surface computes a mood colour itself (no per-mood literal, no valence → hue math); a 2D surface may show an emotion colour (a dot, a star preview) but never mixes it into chrome →=UI
  - the memory context owns emotion facts and never a colour; the server stores colour only as a user's preference →=MOOD-9
- MOOD-7 [o] emotion axes never reach position or connection: valence and arousal feed colour, and arousal also feeds initial strength (size) and forgetting speed →!INV-3
  - valence is colour-only: no strength, layout, synapse or forgetting function takes valence or an `Emotion`; those signatures take one arousal scalar
  - initial strength: `ArousalToInitialStrength` (Go `internal/memory`) and `arousalToInitialStrength` (TS `packages/emotion`) clamp arousal to 0..1 and map it linearly onto [`emotion.arousal_strength_min`, `emotion.arousal_strength_max`]; launch seeds `base_strength` with it →=ENC-13
  - arousal slows forgetting →=FORGET-6
  - golden parity: `packages/emotion/fixtures/arousal-strength.golden.json` is canonical; the Go test reads its byte-identical mirror in `apps/api/internal/memory/testdata/` (the API Docker gate mounts only `apps/api`), and the TS test asserts the two files are identical
  - guards: `packages/universe/src/build-graph.test.ts` (no emotion term reaches the simulation), `star-channels.test.ts` (colour bound to emotion only)
- MOOD-8 [o] the authored palette `defaultMoodPalette` (`packages/emotion/src/palette.ts`) is code content, not a values key; each colour is authored in OkLCH with one job per channel
  - hue is the feeling's identity: the warm arc (rose to green) reads pleasant, the cool arc (teal to magenta) unpleasant →~DECOR-3
  - chroma is vividness: `ANGER` the most saturated, `NEUTRAL` near-colourless
  - lightness follows the hue, never the feeling: every colour sits on one of three steps, L 0.80, 0.72 or 0.63, the 2D language's shared ladder (→=UI) ← rendered luminance is the colour's lightness times the brightness channel, which belongs to forgetting (→~FORGET-15); a free lightness would make two equally bright memories read unequal by mood
  - guards (`palette.test.ts`): every colour on a step, and no pair closer in OkLab than `palette.similar_delta_e_min`, so the defaults never self-warn
  - `ALTERNATIVE_MOOD_COLORS` is a second complete authored table with no id, reachable from no preference; only the demo's palette toggle applies it →=DEMO
  - both authored tables pass the axis check →!MOOD-17
- MOOD-9 [o] a user's colour preference is per mood: at most one stored colour per (user, mood), and a mood without one wears its authored colour
  - resolved table = `defaultMoodPalette` overlaid with 0 to 13 rows (`resolveMoodColors`), applied whole through `setMoodPalette` (`applyMoodColors`)
  - no palette id, no named set, no catalog, no "chosen default" record: absence of a row is the default
  - free and ungated: no Twinkle, purchase, unlock, ornament or achievement gate, and never an achievement reward →=DECOR-10
  - presentation only: a preference never changes a memory's mood, axes, strength, position, connection or forgetting →!DECOR-2
  - rendering is preference-agnostic: it receives resolved colours only and knows no account
- MOOD-10 [o] the account context owns colour preferences in `mood_colors(user_id, mood, color, updated_at)`, primary key `(user_id, mood)`
  - CHECK `mood` ∈ the 13 moods; CHECK `color ~ '^#[0-9a-f]{6}$'` (lowercase); a missing row is meaningful absence, not a DB default
  - `internal/account` declares its own closed `Mood` set (`mood_color.go`) and imports no `internal/memory`
  - every statement is scoped by `user_id` →=ACCT-1
  - the withdrawal purge deletes the user's rows →=ACCT-10
- MOOD-11 [o] `AccountService` colour RPCs: `GetMoodColors`, `SetMoodColor`, `GetMoodColorStats`; no request can name a user id, and each requires an authenticated, signed-up account
  - `GetMoodColors` returns only the caller's explicit rows; both reads are `NO_SIDE_EFFECTS`
  - `SetMoodColor(mood, color)` returns the stored `MoodColor`; the client takes the returned colour as confirmed truth
  - invalid mood or colour ⇒ `ACCOUNT_MOOD_COLOR_INVALID` (InvalidArgument) →=ERR
  - the server snaps lightness to the nearest step (0.80, 0.72, 0.63) keeping hue and chroma; a colour whose snapped form leaves sRGB by more than the 8-bit encoding tolerance (2/255) is rejected with the same reason, never clipped ← clipping would silently change the hue or chroma the user chose
- MOOD-12 [o] a colour write and its aggregate counters change in one transaction, atomically and idempotently
  - order: transaction advisory lock on `(user_id, mood)` → read the previous row → decrement the old exact swatch when the colour changed → upsert the row → increment the new exact swatch
  - the advisory lock covers the first write, where no row exists to lock: concurrent first writes cannot count twice
  - an identical retry moves no counter; a counter that reaches zero deletes its row
- MOOD-13 [o] recommendations come from the anonymous aggregate `mood_color_counts(mood, hue_bucket, color, count, first_counted_at)`, primary key `(mood, hue_bucket, color)`
  - no user id, no account link, no individual-account read; `first_counted_at` stamps a colour's first appearance across every account, not a user
  - bucket: 12 chromatic buckets of `palette.hue_bucket_degrees` on the OkLCH hue circle, plus bucket 12 for chroma ≤ `palette.near_neutral_chroma_max`; CHECK bucket 0..12, `count > 0`
  - `GetMoodColorStats(mood)` returns up to `palette.recommendation_count` buckets, each exactly `{bucket, share, swatch_color}`; swatch = the bucket's most-chosen exact colour
  - share = bucket count / the mood's total, always present: no sample floor, one lone choice reports 1.0
  - ranking: count desc, then earliest `first_counted_at`, then hue bucket (exact colour last for swatch ties) ← ranking equal buckets by hue position would order them by an implementation detail
  - the order is the server's alone: the client keeps it as received, never re-sorts, and drops a non-positive share as malformed
  - a colour returning after its row was deleted starts a new `first_counted_at`; anonymous counts survive withdrawal
- MOOD-14 [o] TS and Go colour arithmetic agree under golden parity, because the server stores its result
  - TS owns the full set in `packages/emotion`: OkLab/OkLCH conversion, ΔE and hue buckets (`oklab.ts`), snapping, near-duplicate and overlay (`mood-color.ts`), the sRGB boundary (`gamut.ts`)
  - the Go port in `internal/account` covers only snapping and bucketing; `internal/account/testdata/mood-color-parity.json` pins its outputs
- MOOD-15 [o] a mood's editor offers a closed preset row of three kinds, in order: authored, popular, random; never several swatches of one kind under different labels
  - authored: always first; carries its bucket's share when the aggregate holds that colour, no share line otherwise
  - popular: up to `palette.popular_preset_count` aggregate colours in server order, named by rank (`palette_preset_popular_first`, `palette_preset_popular_rank`), each with its share
  - share copy (`palette_preset_share`) speaks of choices made so far for colours like this one, never an exact-colour count or a crowd
  - the authored colour's bucket fills the authored share and is skipped in the ranked slots, so no colour shows twice; a mood nobody coloured shows fewer buttons, never padding
  - random: shown as the hue wheel; draws a colour on a lightness step and redraws while it lands in a risk band (bounded attempts, then the first draw)
  - a save invalidates that mood's cached stats on both offering surfaces (`moodColorPresetsQueryKey`) ← a share that survived its own contribution states a stale number
  - each preset button's accessible name is its printed title on both platforms; `palette_preset_label` is only the hint
- MOOD-16 [o] the free picker works in OkLCH on the axes a stored colour keeps: free hue, chroma as a fraction of what that hue and step hold in sRGB, lightness as one of the three steps
  - the far end of chroma is always the most colour that exists there, so the picker never offers a colour the server would snap away or reject
  - mobile picks from swatches: 24 hues and 8 chroma stops (0% and 100% included), each button named with its own numeric stop
- MOOD-17 [o] risk is warned live while a colour is chosen and never blocks: a colour carrying a concern asks one explicit confirmation before it is kept →~DECOR-3
  | concern | when (`moodColorRisks`) |
  |---|---|
  | glare | sRGB relative luminance ≥ `palette.glare_luminance_max` |
  | dim | relative luminance ≤ `palette.dim_luminance_min` |
  | faint | OkLCH chroma ≤ `palette.near_neutral_chroma_max` |
  | similar | OkLab ΔE < `palette.similar_delta_e_min` from another mood's current colour; names that mood |
  - luminance, not lightness ← what washes out a neighbour or sinks into the night against bloom is emitted light
  - a mood's own authored colour never carries glare, dim or faint; faint is withheld when the authored colour is itself near-neutral; similar has no exemption; a colour is never similar to the one it replaces
  - the concerns stand while choosing, under no heading; each sentence names the cause, then its cost in the universe (`palette_risk_*`)
  - no concern ⇒ one press saves; any concern ⇒ `palette_confirm_*` asks once more, and confirming keeps the colour
  - `checkPaletteAxisConsistency` (warm/cool against valence beyond `palette.axis_warn_valence_threshold`) runs only over the authored tables in tests; a user's choice is never axis-checked ← judging a reader's colour for a feeling argues with the vocabulary the editor exists to hand over
- MOOD-18 [o] the editor lives in My page's feeling-colour tab: the tab shows the 13 resolved colours and nothing to choose; opening one hands editing to a dialog, a centred modal when wide and a bottom sheet when narrow →~ACCT-9
  - the dialog composes the current-versus-choice preview, the preset row, the free picker and the live concerns
  - nothing writes until save (`palette_save`); then apply optimistically through `setMoodPalette`, persist, and adopt the returned colour; one save in flight at a time
  - live writes recolour through the seam with no `GetUniverse` refetch
  - failed save: palette and sky roll back to the confirmed colours; the dialog stays open with the draft intact and an assertive danger notice inside it above its actions (`palette_save_failed`); a notice on the tab is never the only failure surface
  - warnings use a polite live status; web and native alike
- MOOD-19 [o] the first-signin colour screen offers every mood its colour on a real sky, web and mobile alike; when it shows, how it is left and why nothing records it as seen →=ACCT-33
  - thirteen real star bodies (`universe-render` `MoodStarLayer`) on a real sky, placed by the shared deterministic field generator within `palette.onboarding_field_radius`; it reads no universe memory, and the layer receives only a resolved table and `onSelect`
  - selecting a star selects its mood; a preset applies live and persists only that mood, the other twelve stay visible for comparison
  - the editor's preset row with no free picker and no risk gate; a near-duplicate after the choice shows `palette_near_duplicate`
  - its continue action (`mood_color_onboarding_skip`) stores no colour for an untouched mood ← absence must stay an honest preference state
- MOOD-20 [o] an app-layer gate applies the user's colours before any palette-dependent child mounts →~CLIENT
  - `DecorationBootstrap` (mobile `MobileDecorationBootstrap`) sits in the authenticated subtree below the profile gate; it reads `GetMoodColors` and the ornament selection (→~DECOR-20) and holds children on `common_loading` until both settle
  - colour readiness: the 13 live `moodColor` values equal the resolved ones
  - a failed read settles too and enters on the authored default ← a gate that cannot open must never hold the user
  - a scope change calls `resetMoodPalette()` through the shared user-state reset before the next account's read, so one user's colours never paint another's sky →=CLIENT
  - login, public pages and the demo sit outside the gate →=DEMO
- MOOD-21 [o] placement →=ARCH
  - Go: emotion facts in `internal/memory` (`emotion.go`), free of proto and sqlc types; colour preference in `internal/account` (`mood_color.go`), with `account/pg` the only row mapping
  - TS root `packages/emotion` is pure (no React, no transport): mood, emotion, palette seam, slices, colour arithmetic, risks, presets
  - `@cosimosi/emotion/react` owns preference IO and `useMoodColorEditor`; `@cosimosi/emotion/i18n` owns `moodLabel` and the preset and risk copy projections
  - web and mobile: `features/choose-mood-colors`, `features/change-mood-colors`; the substance is shared from the package and only the ui hosts differ
  - the demo may not import the colour writes or reads that reach `AccountService` →=DEMO

## flow
- colour: `EpisodicMemory.mood` → `moodColor` (active palette = authored default overlaid with `mood_colors`) → star, gist, nebula bleed, sky slices
- edit: open mood(dialog) → preset | picker → concerns(none: save | some: confirm(keep | back)) → optimistic apply → `SetMoodColor`(ok: adopt snapped | fail: roll back, dialog stays open)

## constraints
- values keys owned here: the `emotion.*` group and the `palette.*` group; colour tables, the quadrant table, the strength formula and the colour conversions are code
- the demo applies palettes only in memory and never reaches `AccountService` →=DEMO

## chg
- r1 261102 initial
