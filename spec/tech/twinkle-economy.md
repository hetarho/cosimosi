# tech: twinkle economy

> As-built rules for the `internal/twinkle` bounded context and its storage. The architecture frame is
> [ARCHITECTURE.md](../ARCHITECTURE.md) §2.2–§2.6 and §4; plan [43.stardust-ledger](../plan/43.stardust-ledger.md)
> owns the product shape; the domain policy is
> [policy/domain/twinkle-economy.md](../policy/domain/twinkle-economy.md).

## 1. Boundaries

`internal/twinkle` is a **standalone core context**: it never imports `internal/memory` (or any other context), and
memory never imports twinkle. The two meet only at the composition root (`cmd/api/twinkle.go`), where the
cross-context adapters live (CC2/CC8). The context ships as one package plus its persistence and transport seams:

- `internal/twinkle` — the domain + use-cases: `Balance`, `BalanceRecord`, `LedgerEntry`, the closed `EntryKind`
  (`earn|spend`) / `EntryReason` (`payment|invite|write_diary|recall|gist_view`) sets, the pure functions below, and
  the `Service` use-cases (`GetBalance` / `CheckAndSpend` / `EarnOnWrite` / `ClaimInvite` / `Charge` / `QuoteSpend`).
  No proto, sqlc, pgx, or SDK import; the pure functions take `now` as an argument (the Service's clock is a seam).
- `internal/twinkle/pg` — the context's **only** sqlc/pgx package: the concrete `Store` over `twinkle_balances` +
  `twinkle_ledger_entries` with row↔domain mapping at this edge, plus `InLedgerTx` (the own-transaction runner). It
  declares **no repository interface** — the `LedgerStore`/`LedgerRepo` ports are consumer-owned by the use-cases.
- `internal/twinkle/rpc` — thin Connect handlers for `twinkle.v1.TwinkleService` (`GetBalance`, `QuoteSpend`,
  `ClaimInvite`, `Charge`): proto↔domain map + call, no policy. `GetBalance`/`QuoteSpend` are `NO_SIDE_EFFECTS`;
  `ClaimInvite`/`Charge` mutate and are idempotent per their keys. **Earn-on-write and the spend have no RPC** —
  they are cross-context port calls inside memory's transactions.

## 2. The balance model

`Balance = { Basic, Additional }` (whole Twinkle units).

- **`Additional`** is a stored, carrying counter on the one balance row per user.
- **`Basic` is derived, never stored**: `BasicRemaining(now, resetWindow, spentThisWindow)` yields the full
  `twinkle.basic_daily_amount` when `now` is in a later UTC calendar day than the anchor (the prior window's unspent
  basic is discarded — no carry), else `grant − spent` clamped to `[0, grant]`. A `now` at/before the anchor's day
  derives conservatively as the anchored window — the derivation never over-grants. `DeriveBalance(now, record)`
  reads both tiers off the stored record; a user with no row yet derives as a full-basic lazy-birth default.
- **The reset is lazy** — no cron, no scheduled job ([T4]): the derivation "resets" at read, and the row's
  `basic_reset_window` anchor rolls forward on the first write in a new day. The window rule is `date(now, UTC)` —
  the `ai.daily_call_cap` UTC-day convention reused, and the **one intentional real-time crossing** in the engine,
  isolated to this context (universe time is never read here).

## 3. The pure functions (golden-parity TS↔Go)

`RecallCost`, `GistViewCost`, `PlanSpend`, and `BasicRemaining` live once in Go (`internal/twinkle`) and once in TS
(`packages/twinkle-logic`), read the same generated `twinkle.*` constants, and are pinned identical by
`apps/api/internal/twinkle/testdata/stardust-ledger-golden.json` (both test suites assert every fixture case and
fail on an unknown case). The FE prices pre-spend and shows which tier will pay; the server enforces.

- `PlanSpend(basicRemaining, additional, cost) → {FromBasic, FromAdditional, OK}` — `fromBasic = min(cost,
basicRemaining)`, overflow to additional, `ok` only when the overflow fits; inputs are bounded at 0 so neither
  tier can plan negative. It plans; it never writes.
- `RecallCost(accessibilityCost) → int` = `round(recall_base_cost + recall_depth_coefficient · accessibilityCost)`
  clamped to `recall_max_cost` — **non-decreasing** in the accessibility weight
  ([tech/forgetting-decay.md](forgetting-decay.md) owns that signal; CC3 — no decay math here, no price constant
  there).
- `GistViewCost(semanticStage) → int` = `gist_base_cost − gist_stage_discount · (stage − 1)` floored at
  `gist_min_cost` — **non-increasing** over the gistified stages 1..4; stage inputs below 1 price as stage 1.
- The TS `utcDay` pins zone-less datetime strings to UTC before parsing (JS `Date.parse` reads them as local time,
  which would shift the day boundary by the viewer's offset); non-parseable inputs fall back to the conservative
  same-window derivation.
- The curve shapes, clamps, spend order, and the reset-window rule are **code**; only the seven coefficients are
  `spec/values.yaml` (`twinkle.*`).

## 4. Storage (`twinkle_balances` + `twinkle_ledger_entries`, migrations 00007/00010)

**A balance row + an append-only event log**, not a pure event-sourced ledger: the hot-path read is one PK lookup;
the log preserves auditability, idempotency, and reconstructability.

- `twinkle_balances` — one authoritative row per user (`user_id` PK): `additional`, `basic_spent_this_window`,
  `basic_reset_window`, `updated_at`; `CHECK (additional >= 0)`, `CHECK (basic_spent_this_window >= 0)`. Server-
  authoritative single-writer state (like `universe_state`) — the FE reads, never writes. The daily-grant literal
  never appears in DDL; it arrives at the write as a query argument from the generated constant.
- `twinkle_ledger_entries` — append-only ([I1]): never `UPDATE`d/`DELETE`d by the system. `UNIQUE (user_id,
dedup_key)` is the general idempotency guard (`NULL` opts out — PG treats NULLs as distinct). Migration 00010 adds a
  partial global unique index on non-null payment keys; its preflight aborts with the duplicate keys when historical
  cross-user replay exists and never repairs history by mutation. Reconstruction invariants
  are DB-enforced: `CHECK (amount > 0)`, non-negative `from_basic`/`from_additional`, and a spend's amount must
  equal its two-tier split. `kind`/`reason` are TEXT closed sets owned by the domain, not PG enums.

### The write path (`Store.ApplyBalanceDelta`)

**Update-first, then birth-insert, then retry-update.** A plain `INSERT … ON CONFLICT DO UPDATE` upsert cannot carry
a negative delta: PG evaluates the proposed insert tuple's CHECK constraints even when the row conflicts into the
UPDATE arm. So the delta is applied by `UPDATE` (row lock serializes concurrent spends); a missing row is born by a
separate guarded `INSERT … ON CONFLICT DO NOTHING` carrying the first delta directly (a first-write overdraw is
rejected, never masked); a concurrent birth loses the PK conflict and retries the update against the winner's row.

**Oversell is impossible at the DB layer for both tiers**: the `additional` CHECK rejects a negative tier, and the
in-query **grant guard** (`new basic_spent_this_window <= twinkle.basic_daily_amount`, the grant passed as an
argument) rejects a basic draw past the daily grant even when two spends planned against the same stale read — the
loser surfaces as `ErrBasicGrantExceeded`. The store also rejects negative `basicSpentDelta` (a refund is not a
domain operation) and any delta/amount outside int32 (`ErrDeltaOutOfRange` — never a silent wrap). A stale caller
window never rolls the anchor backward (`GREATEST`); a rolled window starts its spend from just the new delta.

### Idempotency contract

`ApplyBalanceDelta` is **not** dedup-guarded; `AppendLedgerEntry` is (`false` = already-applied retry). The
composing use-case appends the dedup-keyed ledger entry **first** in the same transaction and skips the delta when
the append reports a retry — that pairing is what makes a retried earn/spend idempotent end to end. The dedup keys
are use-case policy: `write_diary:<diaryID>` (once per diary), `invite_signup:<signupID>` (invitee side),
`invite:<signupID>` (inviter side), and a `payment:` key derived from the normalized provider + provider transaction
identity. Payment keys are globally single-use; other keys remain user-scoped. Spends carry no dedup key (each
recall/view is a new event).
`ErrBasicGrantExceeded` wraps the canonical `twinkle.ErrInsufficientTwinkle`: a raced basic overdraw surfaces to the
caller as not-enough-twinkle at the true window state.

## 4a. The use-cases (`internal/twinkle.Service`)

- **`CheckAndSpend(scope, ledger, intent)`** — the real `SpendGate` behavior ([CC2][G1]): price the intent
  (`RecallCost(accessibilityCost)` / `GistViewCost(semanticStage)` — the caller passes only signals), derive the
  balance, `PlanSpend` basic→additional, and on `ok` append the spend row + apply the guarded delta. On `!ok` return
  `ErrInsufficientTwinkle` and write **nothing**. `ledger` is the caller's transaction-bound store (the economy
  seam); `nil` runs the spend in its own `InLedgerTx` (the tx-less gist view). A zero-priced intent writes nothing.
- **`EarnOnWrite(scope, ledger, diaryID)`** — the write grant, `twinkle.earn_write` to additional, dedup-keyed per
  diary; requires the launch's transaction-bound store (`ErrEarnTxRequired` otherwise).
- **`ClaimInvite(scope, inviteCode)`** — passes the opaque code and authenticated invitee to `InviteResolver`; only a
  trusted result binding one signup identity, an existing distinct inviter, and that invitee can credit. Both sides
  derive keys from the signup identity and commit atomically. `UnavailableInviteResolver` is the production default,
  so raw/fabricated account ids carry no value.
- **`Charge(scope, packID, provider, receipt)`** — asks `StorePaymentVerifier` for a trusted claim and validates its
  normalized provider transaction identity, provider, known pack, exact catalog amount, and authenticated beneficiary.
  The opaque receipt never becomes a ledger key or an error detail. `UnavailablePaymentVerifier` is the production
  default until a real store adapter is explicitly bound at `cmd/api`.
- **`GetBalance(scope)`** / **`QuoteSpend(scope, kind, targetID)`** — read-only: derive the balance (lazy-birth
  default for an absent row, no write, no window roll); the quote resolves its depth signal through the
  `SpendSignalReader` port, prices with the same curves, and returns `{cost, covered, shortfall}` (diary-recall =
  the per-memory `RecallCost` sum, [D3]). Both descriptors use the client transport's `userScopedUnaryReadPolicy`, so
  they are authenticated GETs and never shared-CDN cacheable.

## 4b. The cross-context economy seam (composition root only)

Memory declares `SpendGate`/`EarnPort` with an opaque **`EconomyTx`** handle (`any`); recall/launch pass their
transaction surface through it, the gist view passes `nil`. The `memory/pg` store exposes its bound query handle via
`DB()`; `cmd/api`'s `twinkleSpendGate`/`twinkleEarnPort` adapters extract it and bind `twinklepg.NewStore` over the
**same pgx transaction** — the two contexts share the transaction, never the queries, so a spend/earn and its
recall/launch commit or roll back as one. The adapters also translate vocabulary both ways: `memory.SpendIntent` →
`twinkle.SpendIntent` (kind → reason, signals as scalars), `twinkle.ErrInsufficientTwinkle` →
`memory.ErrInsufficientTwinkle`, and memory's read refusals → `twinkle.ErrQuoteTargetNotFound/Unavailable` for the
quote. `memorySpendSignals` implements `twinkle.SpendSignalReader` over memory's published reads
(`RecallAccessibility`, `DiaryRecallAccessibilities` — one batch anchor read per diary, no text/gist payload — and
`ViewableGistStage`, the reached = deepest = cheapest viewable stage); it is bound to the memory service right after
construction (the one two-way seam, closed at the root). Signal reads derive at `GREATEST(guard baseline, real
today)` — the clock a real recall would sync to, with the unborn clock falling back to the latest launched memory
exactly like the sync guard — so a quote and the authoritative spend price the same decay state. The whole-diary
recall spends from the same one-snapshot batch anchors before any reinforce runs, so in-batch neighbor nudges can
never drift the action's price from its quote.

## 5. Per-user isolation (§4)

Both tables carry `user_id`; every query filters by it; every store method requires a non-empty
`platform.UserScope` (`ErrUserScopeRequired`). Product reads/writes remain user-scoped; the one deliberate global
constraint is the partial unique payment-key index, because a provider transaction cannot belong to two users.
`pnpm lint:persistence` enforces query scoping.

## 6. Values (`spec/values.yaml` → `twinkle.*`)

| key                        | value | meaning                                                    |
| -------------------------- | ----- | ---------------------------------------------------------- |
| `basic_daily_amount`       | 100   | daily basic grant, resets each UTC day, never carries [G2] |
| `recall_base_cost`         | 5     | 회고 base term before the depth term [G4][F4]              |
| `recall_depth_coefficient` | 10    | price rise per unit of accessibility weight [G4][F4]       |
| `recall_max_cost`          | 40    | 회고 cap — a silent engram stays recallable [G4][G5]       |
| `gist_base_cost`           | 10    | 요지 열람 price at gist stage 1 [G4][R8]                   |
| `gist_stage_discount`      | 3     | discount per deeper gist stage [G4][R8]                    |
| `gist_min_cost`            | 3     | gist-view floor — cheap but never free [G4][G1]            |
| `earn_write`               | 100   | write grant per launched diary → additional [G3]           |
| `earn_invite_inviter`      | 500   | inviter grant on a valid signup [G3]                       |
| `earn_invite_invitee`      | 500   | new friend's grant on a valid signup [G3]                  |
| `charge_pack`              | 100   | the single v1 pack a verified Charge credits [G3]          |

With the shipped `forgetting.cost_weight_*` (weight ∈ [1, 4]) the effective 회고 price runs 15 (fresh) → 40
(capped); a day's grant covers roughly six fresh recalls or a mix of recalls and gist views. The [G5] relationship
`basic_daily_amount ≥ 5 expected daily ruminations × cheap recall (15)` is pinned by a test over the generated
constants. The pack **price table** (₩/$ per pack) is product content, not a value; `DefaultChargePackID` is the one
v1 pack id (code).
