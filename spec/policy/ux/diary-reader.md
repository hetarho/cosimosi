# policy/ux: diary reader

> UX policy for the 일기장 (diary reader) archive and its "이 일기로 태어난 별 보기" jump. Plan
> [47](../../plan/47.diary-reader-page.md) owns the implementation; the `GetDiaries` read shape is plan 47 (query in the
> memory context, [16](../../plan/16.memory-aggregate-schema.md)); the whole-diary recall + reinforce bundle are plans
> [33](../../plan/33.recall-usecase.md) / [44](../../plan/44.earn-spend-usecase.md); the sync-consent modal +
> acceleration are plan [31](../../plan/31.time-acceleration-ui.md). Reinforces [I1], [I2], [I8], [I10], [G4].

## The original is a free, immutable keeping-place

The reader is a plain reverse-chronological list of the user's `Diary` entries, distinct from the universe. Listing,
opening an entry, reading the **full body verbatim**, and viewing the split (the 2–5 episodic memories it launched, each
a name + primary-emotion color chip) are all **free** ([G4]) — no 별가루 spent, no clock advanced. The reader **never**
mutates, deletes, or re-splits a `Diary` ([I2][D4]); a diary whose memories were all let go still lists as an
original-only record, with no chips ([I1]).

## The universe is primary; the reader is supporting

The universe stays the main surface at `/`; the reader is a supporting archive reached from two doors ([D5]): a
restrained 일기장 affordance in the universe chrome (lands at the list top) and the star-detail 원본 일기 보기 button
(deep-links to that memory's diary entry). Both land on the same reader.

## The jump whole-recalls but never rewrites

"이 일기로 태어난 별 보기" is `RecallDiaryStars` — it syncs the clock, spends, and applies the shared reinforce bundle
(reset `last_recalled_universe_time`, bump `recall_count`/`EffectiveStrength`, reset the semanticize timer, nudge
neighbors [R5]) to every **still-live** memory the diary launched, in one server transaction. It is **never** a
reconsolidation: no `current_text` and no `seed` change ([R6][I8][D3]) — rewriting is per-star only. The request carries
**only** the diary id; the affected memories and the sync interval are server-derived. The recovered brightness/decay/
gist-timer surface on the **next** `GetUniverse` read, not by client-side math.

## The quote and sync consent precede any spend

The server-priced quote (`QuoteSpend(kind=DIARY_RECALL)`, the sum of the diary's per-memory recall costs) is shown up
front; the widget holds no cost curve. When the clock is behind today — or unknown — the **shared sync-consent modal**
opens before the recall: **예** proceeds to `RecallDiaryStars`; **아니오** cancels with the clock **unmoved** and
**nothing spent**. The jump only ever advances the clock, never rewinds ([I10]). A failed recall returns to browsing with
nothing applied; an ambiguous failure closes the jump rather than offer a one-click retry that could double-spend.
