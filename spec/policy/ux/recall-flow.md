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

When the universe clock is behind today, the flow first shows the **reusable sync-consent modal**: **예** proceeds and
the later `Recall` syncs the clock to today **server-side, atomically with the recall**, then the acceleration plays the
returned interval; **아니오** cancels the whole flow with the clock **unmoved** ([R1a][T2][I10]). When the clock is
already today the modal is skipped. The flow itself never calls the clock or sync directly.

## The server decides the branch; the client only reflects it

On confirm the flow makes **one synchronous `Recall` call** (a "떠올리는 중" loading state covers the server-side
compare + recall). The FE **never** decides reinforce-vs-reconsolidate — it reflects the server's `outcome` ([R6]):

- **Prediction error → reconsolidated:** the star's **seed changes, so its shape changes** ([V5]) and its current text
  becomes the rewrite; brightness/decay/gist-timer/strength recover (the visible recovery lands with the forgetting
  visuals). The distortion is **never announced** — the result simply frames the newly-kept account ([R8a]).
- **No prediction error → reinforced:** the star's **shape and text are unchanged**; only the recall recovery occurs,
  and the result states that plainly.

A failed `Recall` applies nothing and returns to a retriable rewrite with the text intact.

## The Diary is never mutated; no price here

Under every branch only the **representation** (seed + current text) changes — the `Diary` is never mutated ([I2][R7]).
The flow **hardcodes no 별가루 price** and proceeds under the allow-all spend gate; economy gating is deferred. web and
mobile run the same flow, sharing the machine + the recall helpers; only the sheet/input hosts fork.
