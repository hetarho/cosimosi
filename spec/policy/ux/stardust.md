# policy/ux: stardust economy (별가루)

> UX policy for how the Twinkle economy is shown, priced, and refilled. Owned by plan
> [45.stardust-ui](../../plan/45.stardust-ui.md); the domain rules (two-tier balance, spend order, cost curves) are
> [policy/domain/twinkle-economy.md](../domain/twinkle-economy.md), and the earn/spend transactions + the real gate are
> [44.earn-spend-usecase](../../plan/44.earn-spend-usecase.md). Reinforces [I2][I11] and PRD [G1]–[G5].

## The balance is always shown

The universe page carries a persistent balance HUD ([G2]): **basic** (the daily-reset allowance) and **additional** (the
permanent carry-over) are shown distinctly, and the spendable **total** is derived (`basic + additional`), never a stored
figure. basic is granted every day ([G5]), so the HUD renders a figure from first login — never a false empty zero. The
HUD reads `twinkle.v1 GetBalance` and refreshes whenever a spend or earn resolves; it never polls (§2.7).

## A spend is priced before it happens

Recall (회상) and gist-view (요지 보기) show their cost **before** they proceed ([G4]): a recall priced by the star's
decay depth (deeper decay → costlier), a gist-view priced by its selected risen stage (deeper gist → cheaper). The figure is a
**server quote** (`QuoteSpend`); the FE never computes a price (CC3 — no price constant appears in the FE). The cost
display returns a proceed/cancel decision only — it never itself performs the spend; the composing flow does.

## Free surfaces are never priced

Meta info (shape / emotion / 작성일 / 강도 / forgetting state), the free forgotten current text, and reading the
original diary are **free** ([G1]) — no cost display appears for them. The cost display appears only on the two paying
actions.

## A shortfall offers a path, never a dead end

When a spend would exceed the balance, the cost display states the shortfall and offers to **charge** rather than
failing silently ([G3]). Everyday remembering from the basic grant never reaches this path ([G5][M5]). A spend refused
at commit because balance or authoritative depth changed after its exact-stage quote recovers into the same charge
path — it re-quotes, it does not dead-end.

## Earn is write / invite / payment — no login bonus

The charge sheet exposes exactly three earn paths ([G3]): **payment** (a verified store receipt sent to `Charge`;
Twinkle credits only after the backend verifies — the FE never credits locally or trusts an unverified receipt, and the
store purchase itself is a deferred seam until the real adapter binds), **invite** (redeem an inviter's code via
`ClaimInvite`; a valid signup grants both sides), and **write-earn** (a restrained reward confirmation when launching a
diary earns Twinkle). There is **no login bonus** anywhere — the daily basic grant plays that role. The charge sheet is
reachable both from a shortfall and from a restrained proactive affordance, so invite and payment stay available when
the balance is ample.

## No meaning-layer or placement control

The balance HUD, cost display, and charge sheet show and transact Twinkle only ([I11]). No emotion, position, strength,
or any meaning-layer word crosses these surfaces, and none of them mutates a `Diary` ([I2]) — the economy gates
_access_ to a recall, never _what the memory is_.

## Copy

All copy resolves through the i18n seam (no raw strings), in a literary, restrained Korean voice — honest and
unpressured about price: state the cost plainly, offer the path, no sales language, no decorative emoji (PRD §3.1).
