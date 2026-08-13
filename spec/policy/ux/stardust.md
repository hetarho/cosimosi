# policy/ux: stardust economy (별가루)

> UX policy for how the Twinkle economy is shown, priced, and refilled. Owned by plans
> [45.stardust-ui](../../plan/45.stardust-ui.md) and
> [67.twinkle-relabel-and-ledger-ui](../../plan/67.twinkle-relabel-and-ledger-ui.md); the domain rules (the two kinds,
> the spend order, the cost curves) are [policy/domain/twinkle-economy.md](../domain/twinkle-economy.md), and the
> history's own surface is [policy/ux/stardust-history.md](stardust-history.md). Reinforces [I2][I11] and PRD
> [G1]–[G5][G2a].

## The balance is always shown, and it is two kinds

The universe page carries a persistent balance HUD ([G2]): **작은 별가루** (recall-only, refilled on the user's own
calendar day) and **별가루** (universal, permanent) are shown distinctly. 작은 별가루 is granted every day ([G5]), so
the HUD renders a figure from first login — never a false empty zero. The HUD reads `twinkle.v1 GetBalance` and
refreshes whenever a spend or earn resolves; it never polls (§2.7).

**별가루 is the unmarked name, and that is deliberate** ([G2a]): Twinkle is the product's single currency, and 작은
별가루 is a use-restricted sub-kind of it — not a second currency. So the general kind carries the plain name and only
the restricted one is qualified.

**The HUD is itself the way into the 별가루 panel.** Pressing the figures — in either of the HUD's two compositions —
opens what they are about: how much is held, the way to come by more, and how it gathers on its own. A separate mark
beside the numbers asking "what is this?" put a second, smaller thing in the corner to aim at, while the numbers were
already what the reader was looking at. The panel's order is the reader's question order — held, then acquired, then
earned — because someone who opens a balance is usually short of it.

**Where a total appears is a judgment, not a convenience.** The HUD shows the derived total, because the paying actions
over the canvas are recalls and a recall really can draw 작은 별가루 → 별가루. The `/me` stardust tab shows **no total**,
because that is the surface a purchase is contemplated from and an ornament prices against 별가루 alone ([P9]) — a sum
there would overstate spending power. The guard is the **absent** number, not an annotation explaining it away.

## A spend is priced before it happens

Recall (회상) and gist-view (요지 보기) show their cost **before** they proceed ([G4]): a recall priced by the star's
decay depth (deeper decay → costlier), a gist-view priced by its selected risen stage (deeper gist → cheaper). The figure
is a **server quote** (`QuoteSpend`); the FE never computes a price (CC3 — no price constant appears in the FE). The cost
display returns a proceed/cancel decision only — it never itself performs the spend; the composing flow does.

A refusal states **how much is missing**, and counts only the kinds that could have paid for that purpose. So the same
balance can cover a recall and refuse a purchase; that is the protection working, and the copy says the number rather
than implying the user did something wrong.

## Free surfaces are never priced

Meta info (shape / emotion / 작성일 / 강도 / forgetting state), the free forgotten current text, and reading the
original diary are **free** ([G1]) — no cost display appears for them. The cost display appears only on the paying
actions.

## A shortfall opens the earn guide, never a purchase and never a dead end

When a spend would exceed what may pay for it, the cost display states the shortfall and opens the **별가루 panel** —
the same surface the balance HUD opens, whose earn guide ([G3]) is the part that answers a shortfall. Everyday remembering from the daily 작은 별가루 never reaches this path ([G5][M5]). A spend refused at commit
because balance or authoritative depth changed after its exact-stage quote recovers into the same path — it re-quotes, it
does not dead-end.

**There is no purchase path in v2.** Payment (스토어/PG) is deferred to v3 (PRD §8.3).

**The panel still carries the way to get more, disabled and saying why.** A reader looking at a balance they have run
down needs to know whether more is coming at all, and silence is a different answer from "아직" — the absent control read
as "this is all there will ever be", which is not what is true. So the control is present, **disabled**, with the reason
in plain words beside it. This is deliberately narrow: nothing points a **recovery flow** at it, and nothing pretends it
can succeed. A shortfall still recovers into the earn paths below, never into this button.

## Earn is the daily refill · 일기 작성 · 업적 · 친구 초대 — and no login bonus

The earn guide **explains** rather than transacts. It lists the four **repeatable** paths with figures from generated
config, and has exactly one affordance: opening `/me`'s **achievements** tab, which is where earning is actually claimed
([A4]). It issues no mutation, so it has no failure state to report.

The one-time signup bonus ([U11]) is deliberately **not** listed. Naming a grant the reader has already received, and
cannot receive again, would read as an offer.

There is **no login or attendance bonus** anywhere — the daily 작은 별가루 refill plays that role by design. The guide is
reachable both from a shortfall and from the balance HUD itself, so a reader who is merely curious how 별가루 gathers
does not have to run out first.

## No meaning-layer or placement control

The balance HUD, the 별가루 panel it opens, the cost display and the stardust tab show and read Twinkle only ([I11]). No emotion,
position, strength, or any meaning-layer word crosses these surfaces, and none of them mutates a `Diary` ([I2]) — the
economy gates _access_ to a recall, never _what the memory is_.

## Copy

All copy resolves through the i18n seam (no raw strings), in a literary, restrained Korean voice — honest and
unpressured about price: state the cost plainly, offer the path, no sales language, no decorative emoji (PRD §3.1).
