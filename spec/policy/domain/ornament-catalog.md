# policy: ornament catalog

> Domain policy for 우주 꾸미기 — what an ornament is, what owning one means, and what wearing one may
> change. Owned by plan [71.ornament-catalog-model](../../plan/71.ornament-catalog-model.md) (the catalog, the two
> tables, the read contract); the purchase transaction is [72.decorate-usecase](../../plan/72.decorate-usecase.md) and
> the reward grant is [75.achievement-tracking-usecase](../../plan/75.achievement-tracking-usecase.md). The as-built
> context rules live in [tech/store-ornaments.md](../../tech/store-ornaments.md), and the panel's UX rules in
> [policy/ux/decoration.md](../ux/decoration.md). Reinforces PRD §5.7 [P4][P6]–[P11], §6 [V10], §7 [I1][I11].

## The rule

**An ornament sells a render-parameter id and nothing else** ([V10][I11]). No purchase, no achievement and no
selection may move a star, change its brightness or size, recolor its emotion, reshape its seed, or lift a faded
memory back over the bloom threshold. This is not a review habit: the catalog row, both tables and every proto
message carry **ids and enums only** — there is no color, size, brightness, seed, position or free-form parameter
field, and no JSON column, so a meaning-bearing write has nowhere to go. Bloom and camera stay scene defaults outside
the catalog, permanently and in every kind, because a lower bloom threshold makes every star read brighter — which is
forgetting visually undone.

**There are exactly five kinds: `BACKGROUND`, `STAR_SHADER`, `GIST_SHADER`, `MOTE` and `MOTE_FIELD`** — the sky the
universe hangs in, the body shape a memory is shown as, the body shape its summary is shown as, and the two halves of
the decorative dust between them: one speck's look, and the space the specks are scattered through. The set is closed
in the Go enum, the DDL `CHECK` and the proto at once, so a sixth kind cannot appear without one reviewed change
touching all three. Nothing meaning-bearing is expressible as a kind at all.

**A kind names the surface, never the look that fills it.** `STAR_SHADER` and `GIST_SHADER` are the two bodies;
`MOTE` and `MOTE_FIELD` are the two halves of the backdrop. The renderer's own nouns for what a row resolves to —
`StarShape`, `GistShape`, `BackdropMote`, `BackdropField` — stay on the far side of the projection and appear in no Go
type, table, or proto message. That is why the id prefix is `star_shader.` rather than `star_shape.`: the server can
say which surface is being dressed and nothing more.

**A feeling's color is not for sale** ([P10] as amended). 감정 색은 사고파는 대상이 아니다: the per-mood override lives
in `mood_colors`, is free, and is edited from its own surface — it is not an ornament, has no id in this catalog, and
no price key can exist for it.

**The catalog is code, and its membership is a rule rather than a count.** One row per id the renderer's five
registries publish, derived at implement time and pinned by a fixture both runtimes read. No number of rows is
declared or asserted anywhere; adding a sky to the renderer adds a purchasable ornament by construction.

**A price is a function of the kind, never of the row** ([P9]). The five `store.*_price` keys are the whole price
table, resolved **server-side** before a response leaves — so one number moves a whole kind, a per-row price is
unrepresentable, and no client ever holds the table. They are graded by what a row touches: a body costs more than a
sky, and a sky more than the dust behind it. Ornaments are bought with `GENERAL` Twinkle only; `SMALL` may never fund
one, which the ledger's own `CHECK` enforces.

**Each kind has exactly one free row, and it is that kind's default.** Free means owned by everyone with **no
ownership row ever written** — so there is no signup grant, no backfill, and nothing to migrate. Absence of a
selection row **is** the default.

**Two rows are achievement-only and unbuyable at any price** ([P11]) — at most one in any kind, and most kinds have
none: a row is achievement-only because a capstone pays it, so kinds do not acquire one merely by existing. They carry
no price and report zero. The catalog refuses a purchase of one; it does not merely omit a button. `store` never names the
achievement that pays a row — the direction is one-way, so there is no id to drift.

**Ownership is permanent** ([P9]). Acquired once, by purchase or by achievement; there is no expiry, no quantity, no
revocation and no refund, and the system never updates or deletes an ownership row. Permanence is the absence of a
column, not a rule someone keeps. The single delete is the user's own withdrawal sweep — the exception [I1] already
names — which hard-deletes that user's ownership and selection rows and no one else's.

**Exactly one ornament is applied per kind**, and that is a primary-key fact `(user_id, kind)` rather than an
application check. A selection's id must carry its kind's prefix (`background.` · `star_shader.` · `gist_shader.` ·
`mote.` · `mote_field.`), refused by the schema, so a selection can never hold a foreign kind's id.

**A read always answers, a write never guesses.** The selection read returns one entry per kind, coercing an absent
row and an unknown or retired stored id to that kind's default — so a client boot is deterministic and a retired
ornament degrades to the free look instead of a blank sky. A write refuses an id the catalog does not publish.

**There is no inventory and no equip step** ([P6][P7]). One catalog read answers **every** row, owned and unowned
alike, with ownership as a boolean beside a price. The contract has no inventory-shaped message and no equip method,
so the concept cannot be built without changing the contract. The UX consequence — ownership revealed by price alone —
is [policy/ux/decoration.md](../ux/decoration.md)'s.

## Saving is one thing, or it is nothing

**A save is atomic** ([P8]). Buying the unowned members of a selection and applying that selection are one operation:
a failure anywhere leaves no ownership row, no applied row and no ledger row. There is no state in which a user has
been charged for something they are not wearing, or is wearing something they did not pay for.

**The charge is what the save actually acquired**, never what the client says it is buying. The request carries no
amount at all, and the total is summed over the ownership inserts that reported acquiring a row — so two concurrent
identical saves charge the full price exactly once and zero the second time, and a stale or tampered client total
changes nothing.

**Re-selecting what you own is free, and a save that changes nothing is a successful no-op** — it writes no ledger row
and reports no achievement progress. Wearing something you own is not a transaction.

**An insufficient balance refuses the whole save**, names the item the balance ran out on, and states that nothing was
saved. Not a partial purchase, not a queued one: refused ([I1] — refused, never erased).

**Reverting a kind to its default is free and keeps what you bought.** The applied row is removed (absence is the
default) and the ownership row stays: taking a sky off is not selling it back.

**A save reports only counters** — how many ornaments are owned, that a save happened, which kinds moved. The recorder's
payload has no field for a memory, a mood or any text, so no meaning-bearing fact can ride the decoration path
([A6][I11]).

## Why

Money and achievement must not be able to buy meaning ([I11]). The weakest way to promise that is a review rule over a
`params` column; the way taken is that the column, the field and the message do not exist. A decoration layer that
sits **on top of** the meaning layer, unable to reach into it, is what lets the universe be dressed without any diary
meaning anything different afterwards.
