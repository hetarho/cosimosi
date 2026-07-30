# policy: achievements (surface)

> Surface rules for 업적 — the `/me` tab, the claim, the reward reveal and the unlock notice. Owned by plan
> [76.achievement-ui](../../plan/76.achievement-ui.md). What an achievement may measure and pay is
> [policy/domain/achievements.md](../domain/achievements.md); the as-built context rules are
> [tech/achievements.md](../../tech/achievements.md). Reinforces PRD §5.10 [A4][A5], §5.7 [P11], §7 [I11].

## The rules

**The list is the server's answer, rendered.** The tab shows the whole catalog in the **server-fixed order**, grouped
under the nine axis headings, with unachieved rows present and readable. The surface sorts nothing, filters nothing and
evaluates nothing: `progress`, `target`, `achieved`, `claimed`, `rewardSettled` and the reward amount all arrive
resolved. A client that recomputed any of them would be a second evaluator, and two evaluators disagree eventually.

**A row is exactly one of `locked` · `claimable` · `unpaid` · `claimed`**, derived by a pure function from the three
server booleans. There is **no optimistic claimed state and no optimistic patch anywhere**, so a failed claim cannot
leave a row looking paid — the row reverts by never having moved.

**`unpaid` is a claim whose reward never landed, and it keeps its affordance.** It renders the same button with retry
copy (받기 다시 시도) and explicitly **not** the received line, and it says the reward has not arrived rather than
anything implying it was lost. The one summary above the list counts it as waiting, so the count and the visible buttons
agree.

**The claim is a press, and only a press** ([A4]). It fires from a handler, never from an effect, a mount or a focus, and
there is no auto-claim path in the codebase. The request carries the achievement id and nothing else — no amount, no
ornament, no counter — so a client cannot propose what it earned.

**One claim in flight at a time**, enforced by a single async-command machine instance keyed on the pressed id. A second
row's button cannot start a second claim, which narrows the double-claim window to the server's own uniqueness guard.

**The reveal is a dialog, not a toast.** A self-dismissing toast is exactly a moment that can be missed, and the
recognition is the reward's other half — so it waits to be closed. It names the amount and the new total (or that an
ornament was granted), offers one dismissal, and offers **no navigation**: sending someone to 우주 꾸미기 from a reward
would turn claiming into a funnel.

**An ornament reward is not named here** ([P11]). It renders as one line saying an ornament was granted. The item's
identity belongs beside its acquisition condition in 우주 꾸미기; a second name for the same object on a second surface is
the drift the one-key-one-role rule exists to prevent. No `store_*` string is read on this surface.

**One summary, no badge.** A header states how many rewards are waiting, and that is the only count. There is **no badge,
dot or count** on the tab label or the universe HUD — a nag would undo the trade a manual claim is making.

**The unlock notice is a diff of a read** ([A5]), never a push: the recorder returns `error` alone, so nothing can be
pushed back through a write, and there is no subscription and no polling. Ids that flipped to achieved since the previous
resolution and are still unclaimed become notices.

- **The first resolution of a session enqueues nothing**, by construction — a returning user with unclaimed achievements
  sees no toast burst at sign-in.
- At most `achievement.unlock_notice_max` notices per resolution; the rest are **dropped, not queued**. A diary that
  crosses several thresholds should read as one moment, and the tab already lists every one.
- The notice carries the achievement's name and where it waits. **No reward figure, no button, no navigation.** It
  dwells `achievement.claim_toast_ms` — deliberately shorter than an error's, because an error must be read and an
  achievement only noticed.
- Its queue is **component state, not a store**: a store surviving sign-out would carry one user's unlock into another's
  session. It mounts inside the authenticated subtree only, which is simultaneously why a signed-out visitor never
  fetches the list and why `/demo` cannot mount the watcher. The host's lifetime is not the whole guarantee, though —
  the shared queue lives above auth, so an already-queued notice is dropped at the **session boundary** rather than on
  the host's unmount (see [tech/design-system](../../tech/design-system.md), the one-Toast contract).
- **The host is a shell.** The diff, the cap, the first-resolution silence and the notice's composition all live in
  `packages/achievement`; each app's `AchievementNoticeHost` resolves only the toast queue and the copy. The two files
  are identical because there is nothing platform-specific left in them, not because the body was copied.

**Exactly one `Toast` exists in the tree.** Two owners now speak through it — the error path and the unlock notice — so
`packages/ui` owns a queued-toast context, one forked host per app renders the **head** entry, and both owners push. This
is the contract a later surface must join rather than adding a third portal: two independently-rendered toasts overlap
into something unreadable. `useErrorToast` and `presentAppError` are unchanged, so no existing consumer knows the toast
moved.

**A repeat claim is success, not an error.** There is no `ALREADY_CLAIMED` reason to map, because the server replays and
pays. `ACHIEVEMENT_REWARD_UNAVAILABLE` means the claim **was recorded** and only the payout failed, so its copy says the
reward is kept and the row keeps a pressable button.

**Every claim refusal refetches**, the payout one included. The server reports a recorded-but-unpaid claim as its own
state, so the refetch returns an actionable `unpaid` row — the affordance survives the invalidation instead of depending
on this surface's cache staying stale while a dozen unrelated call sites invalidate the same read.

**Copy completeness is a content gate; claimability is a correctness one.** Every string resolves through the
`achievement_*` message family, and an id with no copy entry falls back to a plain label while keeping its progress meter
and its claim button. A server that shipped a row before its words must not hold a reward hostage.

**Nothing on this surface names a meaning-layer fact** ([I11]). No type, prop or handler here carries a memory, a star, a
position, a strength, a mood or a decay/gist stage, and the package this surface is built from depends on none of the
packages that know what those are — the import graph is the guard, not review.

## What this does NOT decide

- **What an achievement measures or pays** — [policy/domain/achievements.md](../domain/achievements.md).
- **Which ornaments exist and what they cost** — [policy/domain/ornament-catalog.md](../domain/ornament-catalog.md) and
  [policy/ux/decoration.md](decoration.md).
- **The ledger row a claim writes** — [policy/domain/twinkle-economy.md](../domain/twinkle-economy.md).
