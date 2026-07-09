# policy/ux: writing flow

> UX policy for the diary → stars write flow. Plan [27](../../plan/27.writing-flow-ui.md) owns the implementation; the
> RPC contract + encode caps are plan [20](../../plan/20.encode-usecase.md). Reinforces [I2], [I3], [I10], [I11], [W4].

## The flow

_일기 쓰기_ (write a diary) → _별 쪼개기_ (split into 2–5 proposed memories, each with a suggested name + primary
emotion) → edit → _별 띄우기_ (launch, a star appears). The split is a synchronous preview that persists nothing; only
launch writes.

## Editing is session-only, meaning-inputs only

- **Within the write session** the user may rename a memory, change its primary emotion (a simple mood selection),
  merge / split memories, and correct neuron normalization — via **touch and natural language**, which reach the same
  result.
- **The editable surface exposes only name / emotion / neuron membership.** There is structurally **no** control for
  position, color, strength, or time anywhere in the flow — the schema-forced request/response carries none, so neither
  the user nor a prompt-injected model can set a placement input ([I3][W4a]).
- **Launched stars are immutable except via natural processes.** Once launched, a star is a persisted past memory and is
  never directly editable from this flow; its representation changes only through recall / forgetting / consolidation,
  and the `Diary` is persisted **immutable** and only at launch ([I2]).

## Launch is optimistic; the diary is atomic

- On launch the client renders the new star(s) **immediately** and the embeddings / gist / neurons / synapses /
  emergent position fill on the **next** `GetUniverse` read (no polling, no streaming). A **failed** launch persists
  nothing and returns to the editable proposal.
- The `Diary` and its memories are persisted **atomically** at launch, never at split.

## Past-dated diaries

Time is monotonic ([I10]). A diary dated **before** the universe's present **saves the diary but launches no star**
([T1]); the flow surfaces this as a **one-time confirmation notice** before launch, so the outcome is never a silent
surprise. Epic B (the universe clock) revisits the full past-date experience.

## Copy

All user-visible copy resolves through the i18n seam (no hardcoded strings) in a literary, restrained Korean voice —
the poetic vocabulary 별 쪼개기 / 별 띄우기 / 기억의 별, no decorative emoji, no translation-ese. Web and mobile draw
the same message keys.
