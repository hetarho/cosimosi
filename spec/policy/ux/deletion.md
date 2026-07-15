# policy/ux: deletion & letting-go

> UX policy for the delete / letting-go / restore flow. Plan [50.deletion-ui](../../plan/50.deletion-ui.md) owns the
> implementation; the backend contract is plans [49.release-usecase](../../plan/49.release-usecase.md) (the four RPCs +
> the 30-day window) over [48.deletion-rules](../../plan/48.deletion-rules.md). Reinforces [I1][I2][I3][I5][I11] and PRD
> [X1]–[X7][W6].

## Deletion is the user's explicit act — never the system's

The flow is the one place the [I1] deletion exception is exercised. It triggers no system-driven delete and offers **no
"delete permanently now"** — the only hard delete is the backend's post-window sweep. Full delete is one plainly-worded
confirm (no punitive type-to-confirm friction); removal is the user's deliberate choice.

## Full delete is diary-scoped and reversible for 30 days

Confirming affects **all stars born from the diary** — the flow previews/lists them and states it. It calls
`Release(diary_id)`; on success the stars are optimistically removed (no residual pull) and the record enters a **30-day
restore window** (read from generated config, never hardcoded). A soft-deleted release group can be `Restore`d within
the window. The confirm carries **two reassurances**: the restore window, and that the objective record is **preserved
and exportable** through the window (linking the provenance export, [W6][D4]) and permanently removed only after the
sweep.

## Letting-go is symbolic, permanent, and semantic-only

Letting-go runs in four steps — **say the words → `SuggestLetGo` → the user approves which to seal → `LetGo`**. The AI
only **suggests** this-memory-only semantic-neuron candidates; the **user decides** which are sealed. It seals **semantic
neurons only** — emotion, time, space, entity, color, and the star are kept, so the memory persists as a **silent
engram** (color/shape/position live on; content reads thinned on the next read). It is **permanent — no timer, no undo,
no restore**; the UI says so plainly at the seal step and reminds that the original words remain exportable (the diary
itself is not deleted, [I2]).

## No efficacy claim; heavy-state guidance is gentle and non-gating

Letting-go copy frames the act as **symbolic release / blurring** and claims **no therapeutic efficacy**; no screen
implies the app substitutes for care ([X7]). When the backend flags a **heavy-state** signal on the `SuggestLetGo`
response, the flow surfaces a gentle, **non-blocking** professional-resource notice before the approve step — advisory,
never gating; the detection is the backend's, the UI only renders it.

## The meaning layer is untouchable; the record is immutable

Every request carries **only** `{ diary_id }` (delete/restore) or `{ episodic_memory_id, approved_neuron_ids }`
(letting-go) — no `kind`, emotion, position, color, strength, or time field, and no way to command a hard delete or seal
a shared/foreign neuron ([I3][I11]). Neither flow mutates the `Diary` in place ([I2]); the export reassurance ([W6]) is
shown in both.
