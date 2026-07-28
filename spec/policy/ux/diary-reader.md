# policy/ux: diary reader

> UX policy for the 일기장 (diary reader) archive and its "이 일기로 태어난 별 보기" jump. Plan
> [47](../../plan/47.diary-reader-page.md) owns the reader and
> [68](../../plan/68.diary-search-and-filter.md) owns archive search/filter/calendar visibility; the `GetDiaries` read
> shape originates in plan 47 (query in the memory context,
> [16](../../plan/16.memory-aggregate-schema.md)); the whole-diary recall + reinforce bundle are plans
> [33](../../plan/33.recall-usecase.md) / [44](../../plan/44.earn-spend-usecase.md); the sync-consent modal +
> acceleration are plan [31](../../plan/31.time-acceleration-ui.md). Reinforces [I1], [I2], [I8], [I10], [G4].

## The original is a free, immutable keeping-place

The reader is a plain reverse-chronological list of the user's `Diary` entries, distinct from the universe. Listing,
opening an entry, reading the **full body verbatim**, and viewing the split (the 2–5 episodic memories it launched, each
a name + primary-emotion color chip) are all **free** ([G4]) — no 별가루 spent, no clock advanced. The reader **never**
mutates, deletes, or re-splits a `Diary` ([I2][D4]); a diary whose memories were all let go still lists as an
original-only record, with no chips ([I1]).

A released diary disappears from every archive view — list, search, filters, and calendar — while its release group
exists. Restore removes that group and the diary returns to every view without rewriting the original or requiring
another archive-specific write.

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

## A row is recognised without a title

A closed row is the diary's date, a length-bounded preview of its body, the count of stars born from
it, and its distinct mood dots — nothing else, and no title field exists at any layer ([D6]). Writing
friction is the thing the product fights, so the row carries the recognition load instead of asking
for a headline. The dots are the diary's distinct moods in the palette's own declaration order, capped
with a `+N` remainder; a diary whose memories were all let go shows a count of `0`, no dots, and never
`NEUTRAL`'s colour — the absence of a recorded feeling is not a feeling ([M3][I1]).

## The preview is a prefix of the original, always

The searchable and previewable surface is the immutable `Diary.body`. The preview is computed on the
client as a whitespace-collapsed prefix — never `CurrentText`, never a server-derived summary, and
never an excerpt re-centred on a search hit, because a match-centred snippet is how a query would
start restoring words forgetting had removed ([D10][I2][F1][G1]). Marking the keyword inside text the
row is already showing is allowed; moving the window to find it is not.

## The archive is free and time-frozen, and says so once

Listing, previewing, sorting, filtering, searching and reading the original spend nothing and advance
no universe time ([D11][G4][T3]). The reader states this in one restrained line rather than repeating
it per control.

## Exactly one paid door, marked as such

"이 일기로 태어난 별 보기" is the only control on the page that spends. It carries a stardust marker and
one line saying so, it still shows no amount (the quote belongs to its dialog), and the destructive
delete sits apart from it — destructive is not the same as paid ([D3][D11]). The free surfaces cannot
price anything by shape: the list's props have no cost, balance, quote or spend field, and a paid
affordance can only arrive through the composing widget's action slot.

## Conditions are addressable on web, and never half-applied

On web the keyword, moods, date range and order live in the address bar, so a filtered archive is a
shareable link and Back restores the previous conditions; on mobile the same shape lives in screen
state ([D7][D8]). A condition the read would refuse — a keyword below the minimum, a half-typed date,
an inverted range — is **not** committed: the reader keeps the previous result set and a hint says
why, rather than watching the archive become an error mid-keystroke. Changing any condition starts a
fresh keyset page, scrolls to the top, and closes the opened row, because the opened entry may not be
in the new result set. A star's 원본 일기 deep link searches the **whole** archive: active conditions
are lifted first, since paging a filtered one would run out of pages and drop the request.
