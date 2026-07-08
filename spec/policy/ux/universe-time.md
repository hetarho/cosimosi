# policy: universe time (the visible clock)

> UX policy for how universe time is shown and felt. Owned by plan
> [31.time-acceleration-ui](../../plan/31.time-acceleration-ui.md); the clock's domain rules live in
> [policy/domain/universe-clock.md](../domain/universe-clock.md). Reinforces [I10][I11] and PRD
> [T2][T3][T6][R1a].

## The rules

**The universe time is always shown** ([T6]). A persistent, restrained "우주의 시간" HUD on the
universe page shows the current universe time — the last diary date — read from `GetUniverse` via
the `entities/universe-clock` mirror. While the clock is unborn (an empty universe), the HUD shows
the empty-universe line ("첫 일기와 함께 흐르기 시작해요"), never a date and never a blank.

**Advancing time is felt, never silent** ([T2][T3]). A launch or recall that moves the clock plays a
forward-only acceleration over its advance interval `[previous, current]`: a neutral veil dims the
scene while the HUD date sweeps to the new present, and the launched memory's reveal (the awaken
entry) lands **after** the transition — accelerate, then the star appears. Viewing plays nothing.
An empty interval (a past-dated or same-day launch — no time passed) plays nothing. The acceleration
is presentation only: persistence, the optimistic insert, and the universe refetch are never gated
on it, and a skipped or interrupted animation loses nothing but the beat.

**The transition is a reserved slot** ([V8][C8]). The acceleration's own content stays neutral; the
forgetting-dimming and gist-rising / replay choreographies land inside the same interval seam when
their epics ship, without re-plumbing.

**Syncing to today requires consent** ([T2] case 2 / [R1a]). Before a recall pulls the clock to
today, the sync-consent modal states the consequence plainly — "회상하려면 우주 시간을 오늘로 맞춰야
해요. 그 사이 안 쓴 과거 날짜의 일기는 이후 추가할 수 없게 됩니다. 진행할까요?" — and offers
**예 / 아니오**. 예 proceeds (the recall syncs, then the acceleration plays the committed interval);
아니오 — and every ambiguous exit: backdrop, ✕, escape — cancels with the clock unmoved. The modal
returns a decision only; it never calls the backend.

**No rewind, no placement, no meaning control** ([I10][I11]). The time overlay shows time, plays a
forward-only acceleration, and consents to a sync — it carries no control that could rewind the
clock, move a star, or edit meaning.

**Motion respects the user.** The acceleration honors the OS reduced-motion setting: the sweep
resolves immediately (the date lands, the reveal releases) with no veil.
