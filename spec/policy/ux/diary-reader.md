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
another archive-specific write. The way back is a plain **지운 일기** word standing at the top of the archive, above the
search controls, that opens this session's released groups in a modal — what was deleted is not what the reader came
here for, so it holds no panel's worth of the page open and waits as one line. With nothing restorable the word is
**absent** rather than disabled: on almost every reading there is nothing to restore, and a disabled control claims
something is here that cannot be reached right now.

## The universe is primary; the reader is supporting

The universe stays the main surface at `/universe`; the reader is a supporting archive reached from two doors ([D5]): a
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

## A card is recognised without a title

A closed card is the diary's date, a length-bounded preview of its body, the count of stars born from
it, and its distinct mood dots — nothing else, and no title field exists at any layer ([D6]). Writing
friction is the thing the product fights, so the card carries the recognition load instead of asking
for a headline.

**Every card is the same height, and the preview is exactly one line, cut with an ellipsis.** Three
single lines — date, preview, footer — is what makes a grid of cards read as a grid rather than as a
ragged wall, and it lets the eye run down a column of dates without the rows shifting under it. A
second preview line bought a little more text at the cost of the one thing the grid was for; what the
one line cannot hold, opening the entry does. The dots are the diary's distinct moods in the palette's own declaration order, capped
with a `+N` remainder; a diary whose memories were all let go shows a count of `0`, no dots, and never
`NEUTRAL`'s colour — the absence of a recorded feeling is not a feeling ([M3][I1]).

## The archive has as many columns as the width holds

The list is a **grid whose column count is measured, not named**: the width divided by
`diary_reader.row_min_width_px` is how many cards sit across, so the archive gains a column whenever the
window has room for one and no width has a layout nobody designed for. A phone shows one column and a
wide desktop several, from the same rule rather than from a breakpoint table. The page is therefore
**not** capped at a reading column — nothing on it is long-form; the entry a reader actually reads opens
in a dialog, which keeps its own measure.

The windowing survives the columns ([D6]): the column count is the virtualizer's lane count, so a
four-column archive mounts four cards per windowed row rather than four times the DOM. A card's width
and offset are percentages of the list, so a resize re-lays the grid without waiting for a measurement
pass.

## The preview is a prefix of the original, always

The searchable and previewable surface is the immutable `Diary.body`. The preview is computed on the
client as a whitespace-collapsed prefix — never `CurrentText`, never a server-derived summary, and
never an excerpt re-centred on a search hit, because a match-centred snippet is how a query would
start restoring words forgetting had removed ([D10][I2][F1][G1]). Marking the keyword inside text the
row is already showing is allowed; moving the window to find it is not.

## A row opens the entry; it never expands

Choosing a row opens that diary as **its own modal over the archive** rather than unfolding it in place. A row that
expanded would push everything under it down and leave the reader's place somewhere else when it folded back; the modal
leaves the list exactly where it stands, and dismissing it lands on the row that opened it. So the row is one press with
one meaning — it says it opens a dialog, and it carries **no control of its own** — while the opened entry is where the
verbatim body, the split chips and every control that acts on the diary live.

The opened entry is **one body, wherever it is opened from**: the archive's own modal and the calendar's day modal show
the same verbatim text, the same split chips, the same paid door beneath it and the same delete in its corner, so a
diary reads and answers identically however it was reached. A star's 원본 일기 deep link is that same opening — the
list scrolls to that diary's row and the entry opens over it.

## The archive is free and time-frozen, and shows it rather than stating it

Listing, previewing, sorting, filtering, searching and reading the original spend nothing and advance
no universe time ([D11][G4][T3]). The reader carries **no line saying so**. The guarantee is carried by
shape instead: exactly one control on the page wears a stardust marker, and everything else is
unmarked — so a standing sentence about what is free could only restate what the absence of markers
already says, at the top of a page whose first job is to be read. The claim itself is not weakened by
dropping the sentence: it is enforced by the props ([D11] — the list has no cost, quote or spend field,
and no action slot at all).

## Reaching the end of the archive says nothing

The list speaks only while it is **fetching**. There is no closing line under the last card: running
out of cards announces itself, and a sentence saying so takes the reader's eye off the writing to tell
them what they can already see. The last page and a paused scroll therefore look the same — which they
are, to a reader who has stopped scrolling.

## The header: the way out on the left, the page's name in the middle

The way back to the universe sits at the **left** end of the header and the page's name is **centred**
on the line, with the 목록/달력 toggle at the right end. The way out wears the product-wide back form —
a bare left arrow and its destination, no fill and no rim (design-language §6) — so it reads as the
room's door rather than as an action taken on the page. A title that began a row of controls read as
the first item in that row; centred, it reads as the name of the place. The way out leads because that
is where a reader reaches for one, and because the archive is a page people arrive at and leave from
rather than one they act on. The same three-part header is the account home's ([64]), so leaving any
supporting surface is the same gesture in the same corner.

## Exactly one paid door, marked as such

"이 일기로 태어난 별 보기" is the only control on the page that spends. A stardust marker rides beside the
control and carries "this one costs" on its own — no second line repeats it — and it still shows no
amount (the quote belongs to its dialog). Both it and the destructive delete belong to the **opened
entry**, never to a row: the paid door sits under the body it would act on, and the delete is a bare
glyph in the entry's top-right corner, so **distance and form** are what separate them — destructive is
not the same as paid ([D3][D11]). The glyph sits in the entry's own corner rather than in the modal's
header, because on a narrow screen that header is the sheet's drag surface, and a press there that
became a downward drag would be ambiguous between deleting this diary and dismissing it. The glyph is
not anonymous: 이 일기 지우기 is its accessible name, and on web a tooltip says it too. The free surfaces
cannot price anything by shape: the list's props have no cost, balance, quote or spend field — and no
action slot at all, so nothing that spends or destroys can be mounted in a row even by mistake. Both
reach the reader only through the entry the composing widget opens.

## Conditions are addressable on web, and never half-applied

On web the keyword, moods, date range, star count and order live in the address bar, so a filtered
archive is a shareable link and Back restores the previous conditions; on mobile the same shape lives
in screen state ([D7][D8]). A condition the read would refuse — a keyword below the minimum — is **not** committed:
the reader keeps the previous result set and a hint says why, rather than watching the archive become an
error mid-keystroke. Changing any condition starts a fresh keyset page, scrolls to the top, and closes the
opened entry, because that entry may not be in the new result set. A star's 원본 일기 deep link searches
the **whole** archive: active conditions are lifted first, since paging a filtered one would run out of
pages and drop the request.

**Every condition is one row, and the row carries no card.** The keyword, the order, the 감정 fold, the
star count and the way back out sit on a single line that **wraps** — a wide screen reads them left to
right, a narrow one stacks the same controls into a gathered block, and no breakpoint decides which
controls exist. They wear no border, fill or panel: the archive is the only thing on this page worth
framing, and a plate around its conditions read as a second surface competing with it.

**The keyword stands in the open and the thirteen mood chips fold behind a toggle.** The chips are two
rows of colour most readings never touch, and the archive is a page for reading. The toggle reads plainly
**감정** and is the fold's only name — a legend inside it would say that word a second time — and it
carries how many are chosen while it is closed. The way out of the conditions stays **outside** the fold,
so a folded panel can neither hide an active filter nor take away the way out of one; it is a reset glyph
rather than a labelled button, named 조건 지우기 to assistive tech and by a tooltip on web, because it is
a small correction beside the controls it undoes and not a third thing competing with them for the line.

**The order is a toggle that says where it is**, not a pair of switches: there are exactly two
directions, so a control offering both spends the row's width restating that. It shows the order the
archive is **in** (최신순 / 오래된순) with the matching glyph, and its accessible name is the **action** a
press performs, so it announces what it does rather than only what it shows. The order is deliberately
**not** a condition: it narrows nothing, so it is absent from 조건 지우기 and from the "filtered to
nothing" state — clearing conditions must not turn the archive back over.

**The star count is a bounded choice behind a button, not a platform picker** — any count, none left,
each exact count, and the top count and above. Every other condition on this line is a button, and a
recessed field well among them was the one borrowed object on the row (design-language §6); the
trigger shows the choice it is holding, and names what that choice counts. Its list hangs from the
trigger's **right** edge, because the control sits at the end of the row and a panel growing rightward
runs off the screen.

**A condition that is narrowing the archive is LIT.** The feelings toggle and the star count wear the
accent while they are on, in the same language a chosen mood chip already speaks. A row of identically
quiet buttons cannot say which of them is currently hiding entries, and leaves the reader to read every
label to find out — which is the same failure the folded mood panel is guarded against. Only the
conditions that **narrow** light up: the order steers the list without hiding anything, so it stays
quiet however it is set, exactly as it is absent from 조건 지우기. `encode.max_memories` is what a split can hold, so the top choice is
"that many or more" rather than an exact number. **Zero is a real choice, not the absence of one**: a
diary whose every memory was let go still lists ([I1]), and asking for exactly those is a question the
archive can answer. A choice the build does not offer — a hand-edited link — leaves the archive
unnarrowed rather than reaching the read as a range no control can express.

**A chosen chip is lit in its own feeling's colour** — that mood on its rim, a halo around it, its dot at
full strength — and an unchosen one is a quiet outline holding a dimmed dot. Choosing nothing is what shows
everything, so the resting state has to read as **off**: thirteen fully-lit dots would read as thirteen
switches already thrown over an archive that is in fact unfiltered.

**The date range has no control of its own.** It stays a field of the read and of the address
(`from`/`to`) and it counts as a condition, so a link carrying it filters the archive and still offers
조건 지우기 as the way back out; no form field on either platform writes it. The archive's own way to a
single day is the calendar.

## 달력 뷰 — the archive has two shapes and one identity ([D12])

The calendar is a **view of `/diary`, not a destination**. The list is the default, a two-option toggle
(목록 / 달력) is the only way in — it rides beside the 일기장 title, because it names which shape the page is
in right now, and **a press anywhere on it lands on the other shape**, since aiming at the correct half
is work a choice between two never needed (design-language §6) — and every other reader affordance survives the switch: the header, the 지운 일기 way back, the
search and filter controls, the star deep-link consumer and the deletion mount all stay
mounted, so entering the calendar drops nothing. Only the body swaps. There is no new route and no new
screen. The **order toggle** is the one thing withheld while the calendar shows — it orders the list, and
a control that steers nothing visible is noise. The other conditions stay mounted (they are the
archive's, not the list's, and they are still there when the list comes back) even though the grid marks
days without regard for them, which the day modal below is what keeps honest.

**A day's color is the top slice of that day's strength-weighted emotions** — the same blend the universe
paints ([M4]), collapsed to one mood. A day may hold several diaries and many moods; the mark asserts the
loudest, never an average, and never a per-diary representative (which the list deliberately does not have
either). The mark is a filled disc under the day number, and nothing animates.

**A written day always shows.** With no live mood — a past-dated diary that launched nothing, or one whose
memories were all let go — it shows as a **border-token outline**, because the writing happened even when the
remembering did not survive. `NEUTRAL`'s color is never used to stand in for absence. An **unwritten** day is
a third state, distinct from both: plain recessed text, not a control at all. Out-of-month cells are present
for grid shape and read the same inert way.

**The calendar is free and time-frozen.** Entering it, stepping months and opening a day cost nothing and
move no clock ([D11][T3]). The **grid** holds no paid affordance and no action slot a spend could be mounted
through — the same guarantee a list row carries — so nothing inside a cell can ever cost. It also shows **no
diary text of any kind**:
its read carries none, so a snippet is unrepresentable there rather than merely forbidden ([D10]).

**Clicking a day opens that day's writing over the month** — a modal holding **every** diary of that day, read
through the archive bounded to exactly that date, so the month being browsed stays where it is and the
archive's own conditions are left alone. Never a guessed single entry: one rule for one and for many. Each
diary in it is the **same opened entry** the list offers — the verbatim body, its split chips, the paid door beneath
it and the delete in its corner — mounted by the composing widget beside the grid rather than passed into it, which
is what keeps the grid's no-action-slot guarantee exact. Taking either closes the day modal first, so no dialog
stacks on another.

**Stepping is prev/next only**, one month at a time, unbounded, with the month label between them. There is no
"today" button and no month picker — on web the `month` param plus Back already return the reader, and the
archive's voice is restrained. A month with no entries reads as a quiet line ("이 달엔 아무것도 적지 않았어요."),
not an error. A month still loading shows the loading state rather than a partial set of marks, because a
half-loaded month would assert the wrong color for a day.
