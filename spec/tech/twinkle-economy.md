# tech: twinkle economy

> As-built rules for the `internal/twinkle` bounded context and its storage. The architecture frame is
> [ARCHITECTURE.md](../ARCHITECTURE.md) §2.2–§2.6 and §4; plans
> [43.stardust-ledger](../plan/43.stardust-ledger.md) and
> [61.signup-and-invite-usecase](../plan/61.signup-and-invite-usecase.md) own the product shape; the domain policy is
> [policy/domain/twinkle-economy.md](../policy/domain/twinkle-economy.md).

## 1. Boundaries

`internal/twinkle` is a **standalone core context**: it never imports `internal/memory` (or any other context), and
memory never imports twinkle. The two meet only at the composition root (`cmd/api/twinkle.go`), where the
cross-context adapters live (CC2/CC8). The context ships as one package plus its persistence and transport seams:

- `internal/twinkle` — the domain + use-cases: `Balance`, `BalanceRecord`, `LedgerEntry`, the closed `EntryKind`
  (`earn|spend`) / `EntryReason` (§2b) sets, the pure functions below, and the `Service` use-cases (`GetBalance` /
  `GetLedger` / `QuoteSpend` / `CheckAndSpend` / `EarnOnWrite` / `EarnSignupBonus` / `EarnAchievementReward` /
  `EarnAdminGrant` / `ClaimInvite`).
  No proto, sqlc, pgx, or SDK import; the pure functions take `now` as an argument (the Service's clock is a seam).
- `internal/twinkle/pg` — the context's **only** sqlc/pgx package: the concrete `Store` over `twinkle_balances` +
  `twinkle_ledger_entries` with row↔domain mapping at this edge, plus `InLedgerTx` (the own-transaction runner). It
  declares **no repository interface** — the `LedgerStore`/`LedgerRepo` ports are consumer-owned by the use-cases.
- `internal/twinkle/rpc` — thin Connect handlers for `twinkle.v1.TwinkleService` (`GetBalance`, `QuoteSpend`,
  `GetLedger`): proto↔domain map + call, no policy. **All three are `NO_SIDE_EFFECTS`, and the contract has no
  mutating RPC at all** — that is the design. Twinkle moves as a consequence of something else: the write earn fires
  from memory's launch through `EarnPort`, a spend through `SpendGate`, a purchase from inside the store context's own
  transaction, a reward from a claim, and the invite/signup credits from the server-side settlement of a signup. The
  economy is never a separate user step, so it needs no mutating contract.

The frontend IO/state boundary is the separate `@cosimosi/twinkle` package: balance Query + invalidation, the
two-kind Zustand mirror, pending-spend/quote adapters, the generated-config-backed charge-pack
projection, and the charge-request channel live there once for web and mobile. React Query hooks use its explicit
`@cosimosi/twinkle/react` seam. Deterministic pricing formulas remain in `@cosimosi/twinkle-logic`; the IO/state
package does not absorb or duplicate them.

## 2. The balance model

`Balance = { Small, General }` (whole Twinkle units), plus `TwinkleKind ∈ {SMALL, GENERAL}` and the per-kind accessor
`Balance.Of(kind)`. `TwinkleKind` is a TEXT-style closed set like `EntryKind` and is **never persisted as a column
value** — the row stores the GENERAL counter and the SMALL window anchor, so the kind is a way of reading a row.

- **`General`** is a stored, carrying counter on the one balance row per user.
- **`Small` is derived, never stored**: `SmallRemaining(now, zone, resetWindow, spentThisWindow)` yields the full
  `twinkle.small_daily_amount` when `now` falls on a later **local** calendar date than the anchor (the prior window's
  unspent SMALL is discarded — no carry), else `grant − spent` clamped to `[0, grant]`. A `now` at/before the anchor's
  date derives conservatively as the anchored window — the derivation never over-grants, which is also what stops a
  westward timezone change from minting a grant. `DeriveBalance(now, zone, record)` reads both kinds off the stored
  record; a user with no row yet derives as a full-SMALL lazy-birth default.
- **The reset is lazy** — no cron, no scheduled job ([T4]): the derivation "resets" at read, and the row's
  `basic_reset_window` anchor rolls forward on the first write in a new day. It is the **one intentional real-time
  crossing** in the engine, isolated to this context (universe time is never read here).

### The day boundary and its port

`ResetWindowOf(now, zone) → date` is the single day-boundary rule: the user's own **local** calendar date, returned as
that date at UTC midnight so it is directly comparable with — and writable as — the stored `DATE` anchor.

- **The zone arrives as a scalar through a consumer-owned port.** `twinkle.UserZoneReader { ZoneFor(ctx, scope)
(string, error) }` in `internal/twinkle/ports.go` returns an **IANA name**, so no `account` type and no
  `*time.Location` crosses the boundary (§2.2/§2.4); `internal/twinkle` imports neither `internal/account` nor any
  `users` query. The only binding is `accountTwinkleZone` in `apps/api/cmd/api/twinkle.go` over `account.ZoneFor`, and
  `NewService` fails with `ErrZoneReaderRequired` when it is nil — production cannot boot with the boundary unbound.
  The package deliberately exports **no** permissive UTC adapter, so a composition root cannot bind the [U7] boundary
  away by accident.
- **`LocationOf(name)` owns the fallback**: empty, blank and unknown names all resolve to `time.UTC` **without an
  error** ([G5] — a missing zone may never deny a refill). Only a genuine port failure propagates, because that is a
  DB error, not an absent zone.
- **`_ "time/tzdata"` is imported by `cmd/api` and `cmd/worker`**, which is what makes `LoadLocation` hermetic on
  `gcr.io/distroless/static-debian12` (it ships no `/usr/share/zoneinfo`). A dev/CI machine _has_ a system zone
  database, so a runtime resolution check alone cannot catch a deleted import — `cmd/api/timezone_test.go` therefore
  asserts both the resolution and the import.
- **The anchor is monotone.** `db/queries/twinkle/ledger.sql` advances it through
  `basic_reset_window = GREATEST(basic_reset_window, $reset_window)`, and both `checkAndSpend` and `earn` pass
  `ResetWindowOf(now, zone)` — never a bare `now`. `earn` resolves the zone of the **credited** scope, not the caller's:
  `ClaimInvite` credits the inviter too, and passing a UTC date for a UTC−n user would push their anchor a day ahead and
  swallow their next refill.
- **`"Local"` is rejected explicitly.** `time.LoadLocation` accepts it as a Go-specific alias for the _process's_ zone,
  which would make a user's day depend on where the server runs — and the TS mirror, resolving through `Intl`, has no
  such alias and would read UTC. `LocationOf` maps it to UTC so the two sides stay identical, and the golden fixture
  carries a `"Local"` case so that parity is pinned rather than merely asserted here. (Profile _writes_ already reject
  it; this covers a historical or hand-edited row.)

## 2b. The `EntryReason` closed set (sole ownership)

`twinkle.EntryReason` is exactly eleven values, in one const block in `ledger.go`, and
[66.earn-and-purchase-spend](../plan/66.earn-and-purchase-spend.md) is its **sole owner** — a plan that needs a new
economic event does not add a reason on its way past.

| reason              | entry point                | amount                                      | dedup key                  | transaction            |
| ------------------- | -------------------------- | ------------------------------------------- | -------------------------- | ---------------------- |
| `daily_grant`       | **none**                   | `twinkle.small_daily_amount`                | —                          | derived, never written |
| `write_diary`       | `EarnOnWrite`              | `twinkle.earn_write`                        | `write_diary:<diaryID>`    | memory's launch tx     |
| `invite`            | `ClaimInvite`, inviter leg | `twinkle.earn_invite_inviter`               | `invite:<signupID>`        | own ledger tx          |
| `invite_signup`     | `ClaimInvite`, invitee leg | `twinkle.earn_invite_invitee`               | `invite_signup:<signupID>` | own ledger tx          |
| `signup_bonus`      | `EarnSignupBonus`          | `twinkle.earn_signup_bonus`                 | `signup_bonus:<userID>`    | own ledger tx          |
| `achievement_claim` | `EarnAchievementReward`    | the caller's validated reward               | `achievement:<claimID>`    | own ledger tx          |
| `admin_grant`       | `EarnAdminGrant`           | operator amount ≤ `twinkle.admin_grant_max` | the console's grant id     | own ledger tx          |
| `recall`            | `CheckAndSpend`            | `RecallCost(weight)`                        | `spend:<opID>:<memoryID>`  | the recall's tx        |
| `gist_view`         | `CheckAndSpend`            | `GistViewCost(stage)`                       | `spend:<opID>:<memoryID>`  | caller's or its own    |
| `ornament_purchase` | `CheckAndSpend`            | the caller's catalog total                  | the caller's purchase key  | the Decorate's tx      |
| `payment`           | **none**                   | —                                           | —                          | retained, historical   |

**Every writable reason has exactly one named entry point, and the two unwritable ones have none — the guard is the
ABSENT METHOD.** There is no exported `Earn(reason, amount)`, so `daily_grant` and `payment` are unreachable by
construction rather than by a validation branch. `TestEntryReasonsAreAClosedSetWithNoLoginBonus` enumerates the set
whole with its classification, so a twelfth value fails the build, and
`TestDailyGrantAndPaymentAreReachableFromNoEntryPoint` exercises all six entry points and asserts neither reason
appears.

`EntryReason.IsSpend()` gives the log direction; `EntryReason.SpendKind()` is the **one** bridge from the persisted
vocabulary to the purpose vocabulary, and `EntryReason.SmallEligible()` delegates through it — so eligibility is
decided in exactly one place no matter which vocabulary asks. `spendPrice` returns only the cost; the kind comes from
the reason, so a spend's price and its SMALL eligibility cannot disagree about what the spend is.

**No PG `CHECK` on `reason` and no PG enum.** A closed-set CHECK on an append-only ledger costs a migration per reason
and risks failing historical rows; the domain owns the set, the schema owns the arithmetic invariants. The one
reason-shaped CHECK that does exist is [P9]'s, because that one guards money (§4).

### `SpendIntent` is opaque, built by three constructors

```go
func RecallSpendIntent(accessibilityCost float64, dedupKey string) SpendIntent   // reason = recall
func GistViewSpendIntent(semanticStage int, dedupKey string) SpendIntent         // reason = gist_view
func PurchaseSpendIntent(amount int, dedupKey string) SpendIntent                // reason = ornament_purchase
```

The fields are unexported because the mix that must be impossible is a **value** question, not a validation one: a
recall intent has no field for an amount (so a caller can never set a recall's own price — [CC3] survives) and a
purchase intent has no field for a decay depth or gist stage (so a curve can never price an ornament). A purchase's
amount is the caller's authoritative catalog total, refused only when non-positive (`ErrPurchaseAmountInvalid`);
twinkle is told what it costs and never learns what was bought, so no ornament id, kind or color can reach the ledger
([I11]).

### Typed insufficiency

`*InsufficientTwinkle{Cost, Eligible, Shortfall}` **wraps** `ErrInsufficientTwinkle`, so every shipped `errors.Is` site
keeps working — including memory's gate mapping and `twinklepg`'s `ErrBasicGrantExceeded`. `Eligible` is the balance
usable for _that_ purpose (`General` alone for a purchase, both kinds for the recall family), so the same balance can
cover a recall and refuse a purchase — the [G5] protection, not a bug. It reaches the client through the shipped
`apperr.Domain(..., metadata)` `map[string]string` channel via `Detail()`, never as a message a consumer must parse:
[72] maps it onto `STORE_INSUFFICIENT_TWINKLE` with the item name it alone knows.

### `GetLedger` — the one read [G7] needs

Keyset-paged newest-first over `(created_at, id)`, never `LIMIT/OFFSET`: an entry landing mid-scroll must not shift a
page boundary and duplicate or skip a neighbour. One static sqlc query (`ListTwinkleLedgerPage`) serves both the first
page and a continuation through two nullable cursor arguments. The cursor is an opaque
`base64url("<created_at RFC3339Nano>|<id>")` mirroring `encodeDiaryCursor`; ties on `created_at` break on the
backend-minted id — arbitrary, but total and stable. The use-case asks the store for one row beyond the page, which is
how "the history continues" is distinguished from "the page ended exactly here" without a second count query.
`page_size` clamps to `twinkle.ledger_page_size` as **both** default and hard cap. A fabricated token is refused
(`ErrLedgerCursorInvalid`) rather than silently restarting the history.

Each entry carries `occurred_on` — the date **already resolved in the user's timezone**, from the same
`ResetWindowOf` the SMALL refill uses — plus `occurred_at` for within-day ordering. The server is the day-boundary
authority ([U7]), so the history's day headers cannot disagree with the allowance the same user just watched refill.
The wire row carries **no `dedup_key`** (they embed diary, signup and claim ids — a leak with no product use) and **no
per-reason payload** (an `ornament_id` would put store vocabulary in the twinkle contract; the reason _is_ the caption).
The wire `LedgerEntryReason` has **no `DAILY_GRANT` member**, so the economy's one non-event is unrepresentable as a row
_and_ as a wire value; both enum mappers send an unknown value to `UNSPECIFIED`, so a row a newer server wrote renders
as "something happened" in an older client rather than as the wrong thing.

## 3. The pure functions (golden-parity TS↔Go)

`RecallCost`, `GistViewCost`, `PlanSpend`, `SmallEligible`, `ShortfallFor`, `ResetWindowOf` and `SmallRemaining` live
once in Go (`internal/twinkle`) and once in TS (`packages/twinkle-logic`), read the same generated `twinkle.*`
constants, and are pinned identical by `apps/api/internal/twinkle/testdata/stardust-ledger-golden.json` (both test
suites assert every fixture case and fail on an unknown case). The FE prices pre-spend and shows which kind will pay;
the server enforces.

**The fixture is Go-generated, not hand-authored:** regenerate it with
`UPDATE_GOLDEN=1 go test ./internal/twinkle/ -run TestWriteStardustLedgerGolden`
(`pnpm test:api` runs the reader; the writer skips without the env var). Its `values` block and case keys use the
`small_*` / `from_small` / `from_general` spelling, `small_remaining` cases carry a `zone` NAME, and `plan_spend` cases
carry a `kind` — including an eligible and an ineligible kind **at the same balance**, so the case proves the kind split
rather than the arithmetic.

- `PlanSpend(smallRemaining, general, cost, kind) → {FromSmall, FromGeneral, OK}` — for a `SmallEligible` kind
  `fromSmall = min(cost, smallRemaining)` with the overflow to GENERAL; for **any other kind `fromSmall = 0`**. `ok`
  only when the GENERAL part fits; inputs are bounded at 0 so neither kind can plan negative. It plans; it never writes.
- `SmallEligible(kind) → bool` — a closed switch over `RECALL`/`GIST_VIEW`/`DIARY_RECALL` whose **default arm returns
  false**, so an unlisted or later-added `SpendKind` is ineligible by construction ([P9][I11]). The eligible set is not
  a new judgment: it is the shipped paid-read set (`memory.PaidActionKind`), and [G4] prices a diary jump as the sum of
  its per-memory recalls, so a diary recall _is_ a recall.
- `ShortfallFor(smallRemaining, general, cost, kind) → int` — `plan.FromGeneral − max(0, general)` when the plan does
  not fit, else 0. Kind-aware by construction: it replaced `cost − small − general`, which over-reported coverage the
  moment a non-recall kind existed.
- `RecallCost(accessibilityCost) → int` = `round(recall_base_cost + recall_depth_coefficient · accessibilityCost)`
  clamped to `recall_max_cost` — **non-decreasing** in the accessibility weight
  ([tech/forgetting-decay.md](forgetting-decay.md) owns that signal; CC3 — no decay math here, no price constant
  there).
- `GistViewCost(semanticStage) → int` = `gist_base_cost − gist_stage_discount · (stage − 1)` floored at
  `gist_min_cost` — **non-increasing** over the gistified stages 1..4; stage inputs below 1 price as stage 1.
- The TS `resetWindowOf(now, zone)` returns the local date as `YYYY-MM-DD` (lexicographically comparable, and directly
  usable for local-day grouping) or `null` for a non-parseable timestamp, which `smallRemaining` treats as the
  conservative same-window derivation. It pins zone-less datetime strings to UTC before parsing (JS `Date.parse` reads
  them as local time, which would shift the boundary by the viewer's offset) and resolves the zone with
  `Intl.DateTimeFormat` inside a try/catch that falls back to UTC — so an unknown zone, or a React Native runtime whose
  `Intl` lacks time-zone support, degrades to the pre-timezone behavior instead of throwing. **No production FE path
  calls the derivation**: the kind is read from `GetBalance` and displayed.
- The curve shapes, clamps, spend order, and the reset-window rule are **code**; only the seven coefficients are
  `spec/values.yaml` (`twinkle.*`).

## 4. Storage (`twinkle_balances` + `twinkle_ledger_entries`, migrations 00007/00010)

**A balance row + an append-only event log**, not a pure event-sourced ledger: the hot-path read is one PK lookup;
the log preserves auditability, idempotency, and reconstructability.

**The persisted spelling is the OLD one, deliberately, and exactly one file may speak both.** The kinds were renamed
from provenance to purpose without a rename migration: an append-only ledger gains nothing from one and the shipped
CHECK constraints would be put at risk ([I1] — this plan ships no `.sql` at all). The mapping is therefore fixed here,
once:

| domain (`internal/twinkle`)          | column                                     |
| ------------------------------------ | ------------------------------------------ |
| `Balance.Small` (derived)            | — (derived from the two below)             |
| `Balance.General`                    | `twinkle_balances.additional`              |
| `BalanceRecord.SmallSpentThisWindow` | `twinkle_balances.basic_spent_this_window` |
| `BalanceRecord.SmallResetWindow`     | `twinkle_balances.basic_reset_window`      |
| `LedgerEntry.FromSmall`              | `twinkle_ledger_entries.from_basic`        |
| `LedgerEntry.FromGeneral`            | `twinkle_ledger_entries.from_additional`   |

`apps/api/internal/twinkle/pg/store.go` is the **only** file permitted to speak both spellings — precisely the
row↔domain role §2.4 gives the pg adapter. Its DB-side vocabulary (`ErrBasicGrantExceeded`, the `BasicGrant` query
argument, the `basicSpentDelta` parameter) stays as-is; only its **domain** field references moved, and the grant
argument now reads `values.TwinkleSmallDailyAmount`. `pnpm lint:language` enforces this: the retired tier identifiers
are rejected everywhere under `apps/api/internal`, `apps/*/src`, `packages` and `proto` **except** `apps/api/db/**` and
`apps/api/internal/twinkle/pg/**`. `00007_twinkle_ledger.sql` is a shipped migration and is not edited — its now-wrong
"UTC calendar day" DDL comment is corrected _here_, not there.

- `twinkle_balances` — one authoritative row per user (`user_id` PK): `additional`, `basic_spent_this_window`,
  `basic_reset_window`, `updated_at`; `CHECK (additional >= 0)`, `CHECK (basic_spent_this_window >= 0)`. Server-
  authoritative single-writer state (like `universe_state`) — the FE reads, never writes. The daily-grant literal
  never appears in DDL; it arrives at the write as a query argument from the generated constant.
- `twinkle_ledger_entries` — append-only ([I1]): never `UPDATE`d/`DELETE`d by the system. `UNIQUE (user_id,
dedup_key)` is the general idempotency guard (`NULL` opts out — PG treats NULLs as distinct). Migration 00010 adds a
  partial global unique index on non-null payment keys; its preflight aborts with the duplicate keys when historical
  cross-user replay exists and never repairs history by mutation. Reconstruction invariants
  are DB-enforced: `CHECK (amount > 0)`, non-negative `from_basic`/`from_additional`, and a spend's amount must
  equal its two-kind split. `kind`/`reason` are TEXT closed sets owned by the domain, not PG enums — with one
  reason-shaped exception, migration `00019`'s
  `CHECK (reason NOT IN ('ornament_purchase') OR from_basic = 0)`: [P9] guards money, so it is stated in the schema as
  well as in `PlanSpend`'s purpose argument, and the guarantee survives a caller that bypasses the use-case.

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
`invite:<signupID>` (inviter side), `signup_bonus:<userID>` (once per account), `achievement:<claimID>` (once per
claim), and — historically only — a `payment:` key derived from the normalized provider + transaction identity. **Spends carry an operation-derived key too** —
`spend:<operationID>:<memoryID>`, minted at the composition
root from the paid action's client operation id (per-action for a single recall/view, per-member when a whole-diary
recall shares one operation id across its members), so a duplicate spend append applies no second balance delta (A3).
Payment keys are globally single-use; other keys remain user-scoped.
`ErrBasicGrantExceeded` wraps the canonical `twinkle.ErrInsufficientTwinkle`: a raced basic overdraw surfaces to the
caller as not-enough-twinkle at the true window state.

## 4a. The use-cases (`internal/twinkle.Service`)

- **`CheckAndSpend(scope, ledger, intent)`** — the real `SpendGate` behavior ([CC2][G1]): price the intent
  (`RecallCost(accessibilityCost)` / `GistViewCost(semanticStage)` — the caller passes only signals), derive the
  balance, `PlanSpend` SMALL→GENERAL for the recall family, and on `ok` append the **dedup-keyed** spend row first (the intent's
  `DedupKey`), then skip `ApplyBalanceDelta` when the append reports an already-applied retry — the same idempotent
  pairing as `earn`, so a duplicate operation draws the balance once (A3). On `!ok` return `ErrInsufficientTwinkle` and
  write **nothing**. `ledger` is the caller's transaction-bound store (the economy seam; both recall and the gist view
  now pass their memory transaction). A zero-priced intent writes nothing.
- **`EarnOnWrite(scope, ledger, diaryID)`** — the write grant, `twinkle.earn_write` to GENERAL, dedup-keyed per
  diary; requires the launch's transaction-bound store (`ErrEarnTxRequired` otherwise).
- **`EarnSignupBonus(scope)`** — an own-transaction `twinkle.earn_signup_bonus` grant to GENERAL with reason
  `signup_bonus`, dedup-keyed per account.
- **`ClaimInvite(scope, inviteCode)`** — passes the opaque code and authenticated invitee to `InviteResolver`; only a
  trusted result binding one signup identity, an existing distinct inviter, and that invitee can credit. Both sides
  derive keys from the signup identity and commit atomically. The two legs carry **different reasons** — the inviter
  is `invite`, the invitee `invite_signup` — so the history can say "친구가 가입했다" to one and "초대로 시작했다" to the
  other from the reason alone. Production binds the account-backed resolver and fails to boot without it; the RPC is
  gone from the wire, so the only caller is the settlement adapter. Inside the ledger transaction, an inviter-keyed
  advisory lock and count of existing `invite:<signupID>` entries enforce the lifetime cap against both concurrency and
  the
  credits-before-account-stamp crash window. An exact dedup replay is allowed at the cap so `rewarded_at` can recover.
  Raw or fabricated account ids carry no value.
- **`EarnAchievementReward(scope, claimID, amount)`** — credits the reward to GENERAL in its own transaction, keyed by
  the **claim** (`achievement:<claimID>`) because claiming is an explicit act. A credit primitive: it decides no
  eligibility, and running outside the claim's transaction is what lets a claim stamped with its reward uncredited heal
  on replay instead of making `achievement` the owner of twinkle's tables.
- **`GetBalance(scope)`** / **`QuoteSpend(scope, kind, targetID, semanticStage)`** — read-only: derive the balance (lazy-birth
  default for an absent row, no write, no window roll); the quote resolves its depth signal through the
  `SpendSignalReader` port, prices with the same curves, and returns `{cost, covered, shortfall}` (gist-view validates
  the selected stage against the reached stage and prices that selection; diary-recall = the per-memory `RecallCost`
  sum, [D3]). Both descriptors use the client transport's `userScopedUnaryReadPolicy`, so they are authenticated GETs
  and never shared-CDN cacheable. The shortfall is **kind-aware** (`ShortfallFor`), so a purpose SMALL cannot pay never
  reports itself covered by the recall allowance.

### `SpendKind`: a Go superset of a deliberately smaller wire enum

`twinkle.SpendKind` is `recall | gist_view | diary_recall | purchase`; the wire enum `twinkle.v1.SpendKind` carries
**no `SPEND_KIND_PURCHASE`**, and `quoteCost` has **no purchase arm** — an unquotable kind falls to the existing
`ErrQuoteInputRequired` default. So no client can ask the recall pricer to price an ornament; an ornament is
catalog-priced by the `store` context and reaches the economy only through its own internal spend gate. `SpendKind` (the
purpose a spend is _planned_ against) also stays distinct from `EntryReason` (the persisted ledger vocabulary): a
`DIARY_RECALL` spend still writes one `recall` row per member memory. Ineligibility is **not** an error — there is no
`ErrSmallNotEligible`; a purchase simply draws zero from SMALL, and the only denial remains `ErrInsufficientTwinkle`.

`spendPrice(intent)` returns the cost **and** the kind from one switch over the closed reason set, so a spend's price and
its SMALL eligibility can never disagree about what the spend is.

**No `buf breaking` gate exists.** `proto/buf.yaml` configures it, but no script or CI workflow invokes it — the
`basic`/`additional` → `small`/`general` field renames (numbers unchanged) therefore had no gate to clear. `pnpm gen` +
`pnpm check:gen` are the only contract gates in the loop; treat wire-compat as a review responsibility, not a checked
one.

## 4b. The cross-context economy seam (composition root only)

Memory declares `SpendGate`/`EarnPort` with an opaque **`EconomyTx`** handle (`any`); recall/launch pass their
transaction surface through it, and the gist view passes its memory-owned transaction. The `memory/pg` store exposes its bound query handle via
`DB()`; `cmd/api`'s `twinkleSpendGate`/`twinkleEarnPort` adapters extract it and bind `twinklepg.NewStore` over the
**same pgx transaction** — the two contexts share the transaction, never the queries, so a spend/earn and its
recall/launch commit or roll back as one. The adapters also translate vocabulary both ways: `memory.SpendIntent` →
`twinkle.SpendIntent` (kind → reason, signals as scalars), `twinkle.ErrInsufficientTwinkle` →
`memory.ErrInsufficientTwinkle`, and memory's read refusals → `twinkle.ErrQuoteTargetNotFound/Unavailable` for the
quote. `memorySpendSignals` implements `twinkle.SpendSignalReader` over memory's published reads
(`RecallAccessibility`, `DiaryRecallAccessibilities` — one batch anchor read per diary, no text/gist payload — and
`ViewableGistStage`, the authoritative upper bound for the selected quote stage); it is bound to the memory service right after
construction (the one two-way seam, closed at the root). Signal reads derive at `GREATEST(guard baseline, real
today)` — the clock a real recall would sync to, with the unborn clock falling back to the latest launched memory
exactly like the sync guard — so a quote and the authoritative spend price the same decay state. The whole-diary
recall spends from the same one-snapshot batch anchors before any reinforce runs, so in-batch neighbor nudges can
never drift the action's price from its quote.

## 5. Per-user isolation (§4)

Both tables carry `user_id`; every query filters by it; every store method requires a non-empty
`platform.UserScope` (`ErrUserScopeRequired`). Product reads/writes remain user-scoped; the one deliberate global
constraint is the partial unique payment-key index, because a provider transaction cannot belong to two users.
`ListTwinkleLedgerPage` is conjunctively scoped over the one relation and `GetLedgerRequest` carries no `user_id` — the
scope is the JWT, so a cross-user history read is unrepresentable rather than validated. `pnpm lint:persistence`
enforces query scoping.

## 6. Values (`spec/values.yaml` → `twinkle.*`)

| key                             | value | meaning                                                                   |
| ------------------------------- | ----- | ------------------------------------------------------------------------- |
| `small_daily_amount`            | 100   | daily SMALL grant, resets on the user's local day, never carries [G2][U7] |
| `recall_base_cost`              | 5     | 회고 base term before the depth term [G4][F4]                             |
| `recall_depth_coefficient`      | 10    | price rise per unit of accessibility weight [G4][F4]                      |
| `recall_max_cost`               | 40    | 회고 cap — a silent engram stays recallable [G4][G5]                      |
| `gist_base_cost`                | 10    | 요지 열람 price at gist stage 1 [G4][R8]                                  |
| `gist_stage_discount`           | 3     | discount per deeper gist stage [G4][R8]                                   |
| `gist_min_cost`                 | 3     | gist-view floor — cheap but never free [G4][G1]                           |
| `earn_write`                    | 100   | write grant per launched diary → GENERAL [G3]                             |
| `earn_invite_inviter`           | 500   | inviter grant on a valid signup [G3]                                      |
| `earn_invite_invitee`           | 500   | new friend's grant on a valid signup [G3]                                 |
| `earn_signup_bonus`             | 500   | one-time post-launch signup grant → GENERAL [G3]                          |
| `invite_reward_max_per_inviter` | 10    | lifetime rewarded-invite cap per inviter [G6]                             |
| `charge_pack`                   | 100   | **retired**; the key survives only until plan 67 deletes its last reader  |
| `ledger_page_size`              | 50    | GetLedger page default AND hard cap [G7][U9]                              |

With the shipped `forgetting.cost_weight_*` (weight ∈ [1, 4]) the effective 회고 price runs 15 (fresh) → 40
(capped); a day's grant covers roughly six fresh recalls or a mix of recalls and gist views. The [G5] relationship
`small_daily_amount ≥ 5 expected daily ruminations × cheap recall (15)` is pinned by a test over the generated
constants. Catalogs are code, not values: an ornament price table and an achievement reward table are context content
owned by `store` and `achievement`.

### Payment retirement (server half)

Payment (스토어/PG) is deferred to v3 (PRD §8.3) and was **removed rather than disabled** — production bound a
guaranteed-fail verifier and the client always threw, so shipping it reachable ships a broken button and an
error-recovery flow pointing nowhere. Gone: `rpc Charge` + its two messages, `Service.Charge`,
`normalizePaymentProvider`, `paymentTransactionKey`, `DefaultChargePackID`, `ServiceDeps.Verifier` and its nil guard,
the `StorePaymentVerifier` port with `PaymentVerificationRequest`/`VerifiedPayment`, `UnavailablePaymentVerifier`, the
five payment errors and the four `TWINKLE_PAYMENT*`/`TWINKLE_CHARGE*` transport reasons.

**Retained deliberately, as historical guards:** the `payment` `EntryReason`; migration `00010`'s
`twinkle_ledger_payment_transaction_key_unique` partial index and its `DO $$` preflight (the ledger is append-only —
dropping the index buys nothing and re-adding it in v3 costs the same preflight); the `reason = 'payment'` arm of
`TwinkleLedgerDedupExists`; and `LEDGER_ENTRY_REASON_PAYMENT` on the wire. A pre-existing payment row still folds into
the balance and still renders in `GetLedger`, and one provider transaction still cannot credit two accounts.

`rpc ClaimInvite` also leaves the wire while `Service.ClaimInvite` and the `InviteResolver` port stay callable from the
composition root: an invite is link-bound ([U8]), so the credit is settled server-side from the signup path and the
user never types a code. The `TWINKLE_INVITE_*` transport reasons stay for that adapter's refusals.
