# policy/ux: star detail panel

> UX policy for the single-star detail panel opened from the universe canvas. Plan
> [35](../../plan/35.star-detail-panel.md) owns the implementation; the recall behavior is plan
> [33](../../plan/33.recall-usecase.md) / [36](../../plan/36.recall-flow-ui.md), the gist read plan
> [34](../../plan/34.view-semantic-usecase.md), the provenance read plan [46](../../plan/46.provenance-export.md),
> the diary reader plan [47](../../plan/47.diary-reader-page.md). Reinforces [I2], [I3], [I8], [I10], [I11].

## Opening and closing

Clicking a node on the running universe canvas opens the panel **over** the scene without remounting the
renderer; deselecting or the close affordance dismisses it. The panel reads the selected id from the
canvas navigation machine — that machine stays the **single owner** of the selection — and owns only its
own view phase (`closed → meta → provenance`).

## Viewing is free and moves no clock

Opening the panel and reading a star's meta and its forgotten current memory text are **always free**:
they advance no universe time ([T3][I10]), spend no 별가루 ([R1][G1]), and restore/reset nothing ([I8]) —
accessibility recovery is a consequence of **recall**, never of viewing. Only the paid acts (recall,
gist view) cost, and they price themselves inside their own flows — no price lives in the panel.

## What each star shows

- An **episodic (big) star** shows shape · emotion color · brightness · 작성일 · 강도 · current
  forgetting state, plus its **forgotten current memory text** rendered faded per decay stage (the full
  text until the forgetting layer stores per-stage texts). Every derived value is read from the shared
  read-time functions, never re-derived in the panel.
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

- **회고하기** (episodic only) → opens the recall flow; the panel emits the request and does **not**
  recall, reconsolidate, price, or spend.
- **변천사 보기** → toggles the in-panel provenance view.
- **원본 일기 보기** → emits the origin-diary navigation intent to the reader.
- A **gist (요지) star** selection routes to the paid gist-view surface instead of this panel.

## The panel only reads

The panel exposes **no** override of a star's emotion / strength / position and **no** placement or
meaning-layer control ([I3][I11]) — it is a pure read surface. web and mobile run the same widget +
features, sharing the machine/resolver and the provenance read model; only the panel host forks (a web
side-sheet, a mobile bottom sheet).
