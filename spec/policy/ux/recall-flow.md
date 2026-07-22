# policy/ux: recall flow

> UX policy for the 회고하기 (recall) flow opened from the star-detail panel. Plan
> [36](../../plan/36.recall-flow-ui.md) owns the implementation; the recall behavior + `Recall` RPC are plans
> [33](../../plan/33.recall-usecase.md) / [32](../../plan/32.reconsolidation-rules.md); the sync-consent modal +
> acceleration are plan [31](../../plan/31.time-acceleration-ui.md). Reinforces [I2], [I8], [I10], [I11].

## Recall is summon-and-rewrite, not restore

회고하기 opens a flow over the running canvas (no renderer remount) scoped to an **episodic** star — never a gist
star. It shows the star's **faded current text** as the prompt to remember and a **rewrite** field; the original
`Diary` is never shown or restored ([I8]). The user rewrites **meaning** — position, color, strength, and time are
structurally unsendable (the request carries only the memory id + rewrite text, [I3][I11]).

## Consent, then atomic sync

Whether consent is needed is a **server** decision, read from the free `SyncStatus` (`needs_sync`) — never computed
from the client's local `Date`, so a client at a UTC boundary or with a skewed clock can neither skip nor spuriously
raise the modal ([R1a], A1). When `needs_sync` is true the flow first shows the **reusable sync-consent modal**: **예**
proceeds and the later `Recall` (carrying `sync_consent = true`) syncs the clock to today **server-side, atomically
with the recall**, then the acceleration plays the returned interval; **아니오** cancels the whole flow with the clock
**unmoved** ([R1a][T2][I10]). When it is false the modal is skipped. The mutation still **re-checks** consent
server-side and refuses an unconsented sync it turns out to need (a race) — the flow then refreshes status and re-shows
the modal. The flow itself never calls the clock or sync directly.

## The server decides the branch; the client only reflects it

On confirm the flow makes **one synchronous `Recall` call** (a "떠올리는 중" loading state covers the server-side
compare + recall). The FE **never** decides reinforce-vs-reconsolidate — it reflects the server's `outcome` ([R6]):

- **Prediction error → reconsolidated:** the star's **seed changes, so its shape changes** ([V5]) and its current text
  becomes the rewrite; brightness/decay/gist-timer/strength recover (the visible recovery lands with the forgetting
  visuals). The distortion is **never announced** — the result simply frames the newly-kept account ([R8a]).
- **No prediction error → reinforced:** the star's **shape and text are unchanged**; only the recall recovery occurs,
  and the result states that plainly.

A successful `Recall` applies the returned representation — including the returned **current text** — to the read-model
mirror and invalidates GetUniverse + the target provenance + balance, so the panel/HUD no longer lag the server (A7).

## Non-dismissible in flight; safe idempotent retry

Each paid recall carries a **client operation id** (A2). While the `Recall` is in flight the "떠올리는 중" state is
**non-dismissible** — Escape, backdrop, the X, and a re-submit are all inert (A4) — and an async completion is fenced to
the active operation, so a closed/reopened/retargeted flow cannot be mutated by a late response. On failure the retry
is classified (A5): an **ambiguous** failure (network/timeout) keeps the same operation id, so a re-submit replays the
server's committed receipt instead of spending twice; a **known refusal** (insufficient balance, consent required, bad
input) committed nothing, so the flow returns to the cost gate / consent modal and the next deliberate attempt mints a
fresh id.

## The Diary is never mutated; the cost gate fronts the spend

Under every branch only the **representation** (seed + current text) changes — the `Diary` is never mutated ([I2][R7]).
The flow **hardcodes no 별가루 price**: it shows the server-quoted cost gate before the rewrite and spends through the
real gate atomically with the recall (a shortfall opens the charge sheet rather than dead-ending). web and mobile run
the same flow, sharing the machine + the recall/session helpers; only the sheet/input hosts fork.
