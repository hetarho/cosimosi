# tech: twinkle economy

> As-built rules for the `internal/twinkle` bounded context and its storage. The architecture frame is
> [ARCHITECTURE.md](../ARCHITECTURE.md) §2.2–§2.6 and §4; plan [43.stardust-ledger](../plan/43.stardust-ledger.md)
> owns the product shape; the domain policy is
> [policy/domain/twinkle-economy.md](../policy/domain/twinkle-economy.md).

## 1. Boundaries

`internal/twinkle` is a **standalone core context**: it never imports `internal/memory` (or any other context).
Memory reaches twinkle's spend through a consumer-owned `SpendGate` port wired at the composition root (CC2/CC8);
until the earn/spend use-case (plan 44) binds it, the Epic-C no-op allow-all gate stays in place. The context ships
as one package plus its persistence seam:

- `internal/twinkle` — the pure domain: `Balance`, `BalanceRecord`, `LedgerEntry`, the closed `EntryKind`
  (`earn|spend`) / `EntryReason` (`payment|invite|write_diary|recall|gist_view`) sets, and the pure functions below.
  No proto, sqlc, pgx, SDK, or IO import; no clock read (`now` is always an argument).
- `internal/twinkle/pg` — the context's **only** sqlc/pgx package: the concrete `Store` over `twinkle_balances` +
  `twinkle_ledger_entries` with row↔domain mapping at this edge. It declares **no repository interface** — the port
  is consumer-owned by the plan-44 use-case, which composes the store's methods inside its transaction (build a
  `Store` over the tx via `NewStore`).

No RPC surface exists yet (`twinkle.v1` is plan 44's). No earn amounts are defined here (plan 44's values).

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

## 4. Storage (`twinkle_balances` + `twinkle_ledger_entries`, migration 00007)

**A balance row + an append-only event log**, not a pure event-sourced ledger: the hot-path read is one PK lookup;
the log preserves auditability, idempotency, and reconstructability.

- `twinkle_balances` — one authoritative row per user (`user_id` PK): `additional`, `basic_spent_this_window`,
  `basic_reset_window`, `updated_at`; `CHECK (additional >= 0)`, `CHECK (basic_spent_this_window >= 0)`. Server-
  authoritative single-writer state (like `universe_state`) — the FE reads, never writes. The daily-grant literal
  never appears in DDL; it arrives at the write as a query argument from the generated constant.
- `twinkle_ledger_entries` — append-only ([I1]): never `UPDATE`d/`DELETE`d by the system. `UNIQUE (user_id,
dedup_key)` is the idempotency guard (`NULL` opts out — PG treats NULLs as distinct). Reconstruction invariants
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

### Idempotency contract (for the plan-44 transaction)

`ApplyBalanceDelta` is **not** dedup-guarded; `AppendLedgerEntry` is (`false` = already-applied retry). The
composing use-case appends the dedup-keyed ledger entry **first** in the same transaction and skips the delta when
the append reports a retry — that pairing is what makes a retried earn/spend idempotent end to end.

## 5. Per-user isolation (§4)

Both tables carry `user_id`; every query filters by it; every store method requires a non-empty
`platform.UserScope` (`ErrUserScopeRequired`). The ledger dedup key is scoped per user — two users may reuse the
same key. `pnpm lint:persistence` enforces the query scoping.

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

With the shipped `forgetting.cost_weight_*` (weight ∈ [1, 4]) the effective 회고 price runs 15 (fresh) → 40
(capped); a day's grant covers roughly six fresh recalls or a mix of recalls and gist views. Earn amounts
(`earn_write` / invite / charge packs) are plan 44's enumeration, not this table's.
