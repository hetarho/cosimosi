# policy/ux: stardust history (별가루 내역)

> UX policy for the `/me` stardust tab's history — the one surface where everything that came and went is readable in
> order. Owned by plan [67.twinkle-relabel-and-ledger-ui](../../plan/67.twinkle-relabel-and-ledger-ui.md); the ledger's
> domain rules and the closed reason set are [policy/domain/twinkle-economy.md](../domain/twinkle-economy.md), and the
> balance/pricing surfaces are [policy/ux/stardust.md](stardust.md). Reinforces [G7][U9][U7][I11].

## One list, newest first

구매 · 수령 · 적립 · 소모 all live in one append-only ledger ([G7]), so they read as one chronological list rather than
per-feature histories. Newest first, matching the diary archive ([D2]) — the most recent thing is the thing a reader came
to check.

Pages arrive by **keyset cursor**, not offset: an entry landing while the reader scrolls must not shift a page boundary
and duplicate or skip its neighbour. The list grows on scroll; there is no page control to operate.

## The day a row belongs to is the user's day, decided by the server

Rows group under day headers taken from the **server-supplied** date, already resolved in `User.Timezone` ([U7]). The
client performs no timezone arithmetic of its own — a device-local grouping would draw headers that disagree with the
작은 별가루 reset boundary the same reader just watched refill, and the reader would be right to trust neither.

## A row says what happened and how much — nothing more

Each row carries its **reason** as the caption, and its **signed amount**. For a **spend** the amount is followed, in
parentheses on the same baseline, by which kinds paid — `−15 (작은 별가루 5 · 별가루 10)` — a step smaller and a step
quieter than the number it belongs to. It is a breakdown **of** that number, not a second fact about the row, and a
full-size line under the reason gave it the weight of one. **No label introduces it**: the parentheses and the two kind
names already say what it is, so a caption over them ("쓴 몫") was a heading for something a reader can simply read.

An **earn** row shows no split at all: every ledgered earn credits 별가루, because 작은 별가루 is refilled by derivation
and never earned — so the two row shapes differ rather than one carrying a permanently empty field.

**A row is never a link into a memory** ([I11]). Not "not wired yet" — the entry carries no episodic-memory id and no
diary id, so there is nothing to navigate to. A jump from an accounting record into a memory would also bypass the recall
price that memory is behind ([G4]).

**A reason whose feature has left still renders.** The ledger is append-only, so a row written before payment was retired
is still the reader's own history, and hiding it would be a quieter kind of deletion. A reason this build has never heard
of renders as "a record" rather than a guess.

## The daily refill is stated, and it is not a row

The daily 작은 별가루 refill is a **derivation**, not an event — it has no ledger row, and inventing one would make the
history claim a transaction that never happened ([G7]). But a reader scrolling for it deserves to know why it is not
there, so the history states it once, at the head, in visually distinct chrome: the amount granted, plus a plain note
that it leaves no record.

**Exactly one, and only for today.** A past day's refill anchor is unrecoverable on the client, so repeating the marker
down the list would fabricate history.

## An empty history is still a full surface

An account with no rows yet still sees both kind figures, the refill marker and one restrained line saying nothing has
come or gone — never a bare empty list ([G5][U9]). 작은 별가루 exists from first login, so there is always something true
to show.

## Copy

All copy resolves through the i18n seam (no raw strings), in a literary, restrained Korean voice. A reason label narrates
the moment rather than naming the mechanism (`회상하며`, not `recall`), and no row is written as a transaction receipt.
