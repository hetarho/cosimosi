# policy/ux: universe decoration (우주 꾸미기)

> UX policy for how decoration is browsed, shown and applied. The catalog-facing half is owned by plan
> [71.ornament-catalog-model](../../plan/71.ornament-catalog-model.md); the panel, its preview and its copy by
> [73.decoration-panel](../../plan/73.decoration-panel.md). The domain rules (what an ornament may change, permanence,
> pricing by kind) are [policy/domain/ornament-catalog.md](../domain/ornament-catalog.md). Reinforces PRD §5.7
> [P4][P6]–[P11] and [V10][I11].

## The panel opens beside the universe, never over it

꾸미기 is a **sheet over the universe page**, not a page of its own ([P5]): it takes the right edge on a wide screen and
the lower third on a narrow one, and the universe keeps the rest — visible, and still camera-interactive. Nothing is
dimmed and no focus is trapped, because the whole reason to open it is to watch a change land in the place it changes.
The renderer is never remounted to show a choice; only the layer that changed rebuilds.

The way in is one restrained affordance in the HUD's existing row, beside the archive and the account home — not a new
chrome bar and not a persistent panel.

## Everything is in one list, and ownership shows up as a price

The catalog is **one list of everything** ([P6]): owned and unowned rows sit together, in the same order, rendered the
same way. What a user does not own is marked by carrying a price — nothing else. There is no owned filter, no
ownership badge, no sort by ownership, and no separate place owned things go.

**There is no 보관함 and no 장착** ([P7]). Nothing is stored to be retrieved later, and nothing is equipped: picking a
row shows it, saving keeps it. The words are absent from the product, and the contract has no message that could
express them, so the concept cannot reappear as a convenience.

**An achievement row shows its condition where a price would be** ([P11]). It is never priced, never buyable, and its
condition text is joined from the achievements surface — the store never names an achievement itself.

## What decoration is allowed to change, as the user experiences it

Decoration changes the **sky** and the **shape a memory's body takes** — the staging around the memories, never the
memories ([P4][V10]). A star's position, brightness, size, emotion color and forgetting state look exactly the same
before and after any purchase; a bought sky cannot make a faded memory read brighter. Nothing in the panel offers to.

**A feeling's color is not sold here.** Choosing what each mood looks like is free, lives on its own surface, and is
edited per feeling — it is a preference, not a purchase ([P10] as amended).

## The universe wears the choice, and only the affected layer changes

A selection applies to the user's real universe rather than to a thumbnail: the sky repaints and the bodies rebuild in
place, and the universe itself is never remounted or reloaded to show a change. Until the selection read lands, each
kind shows its free default — the same picture an undecorated universe shows — so a slow read looks like an
undecorated universe rather than a broken one.

## A row is a name, and the universe is the preview

A row shows **a name and a price, or a name and nothing** — no thumbnail, no blurb, no swatch. Choosing it applies it to
the real universe at once, so the sky itself is the description, and what a name has to do is be sayable: the shortfall
line points at one. Names are the client's ([P6]) — the server sends ids and never learns what an ornament looks like.

## Saving says what happened, and nothing more

A refused save says that **nothing was saved** — the atomicity, plainly — rather than a generic "not enough". The
refusal carries which item the balance ran out on so the surface can point at that row; the generic line never names an
item, because only the surface can turn an id into a name. Recovery points at earning, never at buying Twinkle.

A save that changed nothing is not an error and says nothing: it succeeds quietly. And what a save charged is the
server's number — the surface may show a total before saving, but it is advisory, and the receipt is what came back.

**A save in flight cannot be dismissed.** The close affordance is disabled while it resolves, so a completed save never
lands on a panel that has moved on.

## Leaving is reverting

Closing without saving restores the confirmed selection completely, and so does everything else that counts as leaving:
a route change, a reload, backgrounding the mobile screen, signing out, switching account. The preview is **kept
nowhere** — not in storage, not in a URL, not on the server — so this is what happens by construction rather than what a
handler remembers to do. The only durable write is 저장.

**Absence of a choice is the free default, everywhere.** A user who never opens the panel is not missing anything and
has nothing granted to them; the default is what they already wear.
