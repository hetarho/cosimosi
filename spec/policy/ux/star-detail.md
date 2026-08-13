# policy/ux: star detail panel

> UX policy for the single-star detail panel opened from the universe canvas. Plan
> [35](../../plan/35.star-detail-panel.md) owns the implementation; the recall behavior is plan
> [33](../../plan/33.recall-usecase.md) / [36](../../plan/36.recall-flow-ui.md), the gist read plan
> [34](../../plan/34.view-semantic-usecase.md), the provenance read plan [46](../../plan/46.provenance-export.md),
> the diary reader plan [47](../../plan/47.diary-reader-page.md). Reinforces [I2], [I3], [I8], [I10], [I11].

## Opening and closing

Clicking a node on the running universe canvas opens the panel **over** the scene without remounting the
renderer; deselecting or any of the surface's own exits — the close affordance, the scrim, Escape, and on a
bottom sheet a swipe back down — dismisses it. The panel reads the selected id from the
canvas navigation machine — that machine stays the **single owner** of the selection — and owns only its
own view phase (`closed → meta → provenance`).

**A deletion hand-off is also an exit.** 놓아주기 and 이 별의 일기 지우기 clear the selection as they emit,
so the deletion flow has the screen to itself: two surfaces that each declare themselves modal would stack
two scrims and two focus traps, and a selection left behind points at a star that flow may be about to
remove. Backing out of the deletion therefore returns to the bare canvas, not to the open panel — the star
is one click away, and being returned to a panel about a star the user just decided not to act on reads as
the cancel having failed.

The panel **interrupts**, and its host says so: it is the shared `Dialog`, which is a centred modal on a wide
screen and a bottom sheet on a narrow one. Reading a star is a thing you stop to do, unlike 꾸미기, which is a
change you watch land in the universe beside it and therefore keeps the scrim-less `Sheet`.

## Viewing is free and moves no clock

Opening the panel and reading a star's meta and its forgotten current memory text are **always free**:
they advance no universe time ([T3][I10]), spend no 별가루 ([R1][G1]), and restore/reset nothing ([I8]) —
accessibility recovery is a consequence of **recall**, never of viewing. Only the paid acts (recall,
gist view) cost, and they price themselves inside their own flows — no price lives in the panel.

## What each star shows

- An **episodic (big) star** shows the star **itself, rendered** — the real body, tint, brightness and
  seed the universe gives it, turning slowly against the bare night sky — stacked **above** its rows:
  emotion color · brightness · 작성일 · 강도 · current forgetting state, plus its **forgotten current
  memory text** rendered faded per decay stage (the full text until the forgetting layer stores
  per-stage texts). The one channel the preview does not carry is **size**: size means strength by
  comparison with the other stars, and a star shown alone has nothing to be bigger than — the panel
  states strength as a number instead. Every derived value is read from the shared read-time
  functions, never re-derived in the panel.
- **Every row that is a READING carries an ⓘ that says what it means**, because a number like `0.87` and
  a word like 아스라함 explain nothing on their own, and the rows and the star above them are the same
  facts twice with nothing on the surface saying so. Each hint says where the reading comes from, what
  it does to the star, and what makes it move: **감정** is what the diary was read as and is where the
  colour comes from ([I3]); **밝기** is how vivid the memory still is, falling as universe days pass since
  the last recall and returning with one, never reaching zero ([F1][F2]); **강도** is how firmly the memory
  has settled, raised by every recall, and the higher it is the larger the star and the slower the fade
  ([V3][F7]); **지금 상태** is how far the text has blurred, losing words a stage at a time and reading whole
  again after a recall ([F5]). **적은 날 carries none** — a date is the fact itself, and an ⓘ that only
  said "this is the date" would teach the diarist to stop pressing the others. The hints **open on a
  press as well as on hover**, since the panel is a bottom sheet on a phone where there is no hover to
  open anything with, and they describe only what the shared read-time functions already do — never a
  mechanism the code does not have. They are reads like everything else here: they cost nothing,
  advance nothing, and change nothing.
- A **neuron (small) star** shows **information only — no emotion** ([I3]): name · type · connectivity,
  and none of the episodic actions.
- The free text is the **faded memory, not the original.** The immutable original is reached only via
  원본 일기 보기 (the reader) — the panel never shows a mutable original ([I2][R8a]).

## 변천사 (provenance) shows representation history, distortion unflagged

The 변천사 view lists the star's representation events time-ordered, each labelled by **kind**
(생성 / 요지화 / 재공고화) and **source** (원본 / 시스템 / 사용자). Distortion is **not** separately
announced — the user discovers change by reading the entries ([R8a]). The list shows exactly the ordered
entries the read returns; the created-baseline synthesis is the read's concern, not the panel's.
A transport failure is shown as a recoverable localized error with retry and is never represented as an empty history.
Loading and retrying remain visibly pending; empty copy is reserved for a successful empty payload, an invariant fallback
because a normal successful read contains the synthesized created/original baseline.

## Actions hand off; the panel neither prices nor performs them

The footer holds exactly **one** control, and it is the one a diarist came here for. The four occasional
acts are gathered behind a single control in the **top-right corner of the star's preview frame** (이 별로
할 수 있는 일) — five buttons in a row would make the panel read as a control surface rather than as a star.

- **회고하기** (footer, episodic only) → opens the recall flow; the panel emits the request and does **not**
  recall, reconsolidate, price, or spend.
- **변천사 보기** (menu) → toggles the in-panel provenance view.
- **원본 일기 보기** (menu) → emits the origin-diary navigation intent to the reader.
- **놓아주기** (menu) → emits the letting-go intent for this memory; the flow, the suggestion and the seal
  are the deletion surface's.
- **이 별의 일기 지우기** (menu) → emits the full-delete intent for the star's **source diary**, a delete that
  reaches every star born from that diary rather than the selected one alone. The panel deletes nothing.
- A **gist (요지) star** selection routes to the paid gist-view surface instead of this panel.

The control sits on a wrapper **outside** the preview frame, because that frame is hidden from assistive tech
and clips what it holds: a focusable control inside a hidden subtree cannot be reached, and one inside the
clip is cut off at its corner. The menu also keeps **Escape** to itself — it opens under the panel host's
focus trap, whose own Escape closes the whole surface, and dismissing a list must not dismiss the star.

## The panel only reads

The panel exposes **no** override of a star's emotion / strength / position and **no** placement or
meaning-layer control ([I3][I11]) — it is a pure read surface. web and mobile run the same widget +
features, sharing the machine/resolver and the provenance read model; only the panel host forks (the web
`Dialog`, a React-Native bottom sheet).
