# tech: store — the ornament catalog

> As-built rules for the `internal/store` bounded context and its storage. The architecture frame is
> [ARCHITECTURE.md](../ARCHITECTURE.md) §2.2–§2.7 and §4; plan
> [71.ornament-catalog-model](../plan/71.ornament-catalog-model.md) owns the product shape; the domain policy is
> [policy/domain/ornament-catalog.md](../policy/domain/ornament-catalog.md) and the surface rules are
> [policy/ux/decoration.md](../policy/ux/decoration.md). The renderer registries this context sells ids into are
> [tech/rendering.md](rendering.md) §the two selection seams.

## 1. Boundaries

`internal/store` is a **supporting context** and imports **no other `internal/` context**; nothing imports it either.
Its one cross-context edge — account's withdrawal sweep calling its purge leg — is closed at the composition root
(`cmd/api/store.go` + `cmd/api/memory.go` for the API, `cmd/api/worker.go` for the sweep that actually runs). It ships
as one package plus its two seams:

- `internal/store` — `OrnamentID`, `OrnamentKind`, `OrnamentAcquisition`, `Ornament`, `CatalogItem`,
  `OrnamentSelection`, `OrnamentOwnership`; the in-code catalog (`catalog.go`); the reads (`Catalog`, `Selection`), the
  ownership append (`GrantOwnership`) and the purge (`PurgeUser`); the consumer-owned ports; the declared errors. No
  proto, sqlc or pgx import.
- `internal/store/pg` — the context's **only** sqlc/pgx package: the concrete `Store` over `ornament_ownerships` +
  `ornament_selections`, row↔domain mapping at this edge. It declares no repository interface — the ports are
  consumer-owned. `UpsertOrnamentSelection` lives here with no caller yet **by design**: applying an ornament is one
  transaction with its purchase, so the `Decorate` use-case composes it over its own transaction handle rather than
  through a read port.
- `internal/store/rpc` — thin Connect handlers for `store.v1.StoreService` (`GetCatalog`, `GetSelection`), both
  `NO_SIDE_EFFECTS`: enum map + call, no policy.

The frontend mirror is `@cosimosi/store`, and it holds no colour and no shader constant — what an id looks like is the
renderer's:

- `ornament.ts` — the DTO types, the id↔registry-key split, each kind's default.
- `ornament-names.ts` + `i18n.ts` — one localized name per published id, written out rather than assembled from the id
  (a constructed message key is invisible to the i18n tooling, so a missing name would be a blank row nobody notices).
  A test asserts the pair against the same id fixture, so this is the **third** reader of that one file.
- `ornament-preview-store.ts` — `{ previewActive, previewed, confirmed }`. See §9.
- `decoration.machine.ts` — the panel's phase. See §9.
- `decoration-request-store.ts` — the one-slot open signal, so the HUD affordance can open a widget without a widget
  importing a widget (§3.1).
- `save-eligibility.ts` — `ornamentCost` (the `none | price | condition` discriminant) and `saveVerdict` (the five arms).
  Display arithmetic only.
- `react.ts` — `useAppliedOrnaments()` (what the universe wears), `useOrnamentCatalog()` (the one grouped read) and
  `useSaveDecoration()` (the save + invalidation + scope guard). Both apps read all three; only `ui` forks (§3.5).

## 2. The two tables (migration `00024_store_ornaments.sql`)

```
ornament_ownerships (user_id, ornament_id, acquired_via, acquired_at)
    PRIMARY KEY (user_id, ornament_id)
    CHECK (acquired_via IN ('purchase', 'achievement'))

ornament_selections (user_id, kind, ornament_id, selected_at)
    PRIMARY KEY (user_id, kind)
    CHECK (kind IN ('BACKGROUND', 'STAR_SHADER'))
    CHECK (ornament_id LIKE lower(kind) || '.%')
```

Four load-bearing absences and two load-bearing constraints:

- **No `params`/`config`/`overrides`/JSON column** — the schema half of the [I11] guard: a render parameter's _value_
  has nowhere to be written, only its id.
- **No `deleted_at`, expiry, quantity or revocation column** — permanence is structural ([P9]). The withdrawn-user
  window needs no filter either: the `platform` interceptor rejects a withdrawn scope before any context read.
- **No `kind` column on `ornament_ownerships`** — kind is derivable from the id prefix, so storing it would be a second
  truth (§2.9 #3).
- **No foreign key to `users`**, matching every other product table, so a withdrawn user leaves no cascade.
- `PRIMARY KEY (user_id, kind)` is what makes "exactly one applied ornament per kind" a schema fact.
- `CHECK (ornament_id LIKE lower(kind) || '.%')` is why the id prefix is not decoration: it turns "a selection belongs
  to its kind" into something the database refuses to break.

Both are asserted against a real Postgres in `internal/store/pg/store_integration_test.go` — the constraints are
verified, not just declared.

## 3. sqlc surface (`db/queries/store/`)

`ornaments.sql` — `ListOrnamentOwnerships`, `ListOrnamentSelections`, `InsertOrnamentOwnership`
(`ON CONFLICT (user_id, ornament_id) DO NOTHING` — the primary key IS the dedup key, so a replayed achievement claim or
a retried purchase grants once and never overwrites the original acquisition path), `UpsertOrnamentSelection`
(`ON CONFLICT (user_id, kind) DO UPDATE`).

`purge_user.sql` — `PurgeUserOrnamentOwnerships`, `PurgeUserOrnamentSelections`: the withdrawal sweep's leg, and the
only deletes this context has. Both are listed in `scripts/check-persistence-isolation.mjs`'s `hardDeleteQueries`
allowlist; **no** `platformTables` or `globalQueries` entry was added, because every statement is conjunctively scoped
by `user_id` ([U1]).

## 4. The catalog — code, not a table

`catalog.go` holds `map[OrnamentID]OrnamentAcquisition` as a **literal**: one entry per id the renderer's `SKY_EFFECTS`
and `STAR_SHAPES` registries publish. Written as a literal rather than folded from a slice so a duplicate id is a
**compile** error. Each row's `Kind` is resolved from its id prefix at first import; a prefix naming no kind panics
there, because it is a programming error the DDL would reject anyway.

- Ids are `<lower(kind)>.<registry key>` — `background.grainient`, `star_shader.facet`. The server never parses beyond
  the prefix; the FE splits on the first `.` to pick the registry.
- `Ornaments()` is the only enumeration, in one sorted order, so nobody keeps a second list.
- **No count is declared or asserted anywhere.** Membership is read off the registries.
- Acquisition assignment: each registry's own default → `FREE`; `background.floating-lines` and `star_shader.spire` →
  `ACHIEVEMENT` (one per kind, paid by plan 74's two ornament capstones); everything else → `PURCHASE`.
- `DefaultBackgroundOrnamentID` / `DefaultStarShaderOrnamentID` are **contract constants, not values** —
  `account.DefaultPaletteID`'s shipped rationale — each mirroring its registry's own default.
- `PriceOf` resolves `values.StoreBackgroundPrice` / `values.StoreStarShaderPrice` **by kind**, and returns 0 for every
  `FREE` and `ACHIEVEMENT` row. `RequirePurchasable` is the catalog's refusal of a buy attempt on a row that is not for
  sale (`ErrOrnamentNotPurchasable`), which is what plan 72's `Decorate` surfaces.

## 5. Read behavior

- `Catalog(ctx, scope)` answers **every** row with `Owned` (= `FREE` ‖ an ownership row exists), `Selected` and the
  kind-resolved `Price`. There is no owned-only read to ask for instead.
- `Selection(ctx, scope)` answers **exactly one entry per kind**; an absent row and an unknown or retired stored id
  both coerce to that kind's default. A read must always answer — while a write must never guess, which is why
  `GrantOwnership` refuses an unpublished id (`ErrUnknownOrnamentID`) instead of coercing.
- `GrantOwnership(ctx, scope, id, via)` is the append both legs land through; it runs in its own transaction so the
  ownership row and the `ornament_owned` counter commit together, and a counter-report failure rolls the grant back
  (losing the count would leave a fact nothing re-derives; a failed grant is retried by the claim that called it).
  `AcquisitionFree` is refused
  (`ErrAcquisitionNotGrantable`) because a free row is owned through the ABSENCE of a row.
- `PurgeUser(ctx, scope)` delegates to the pg leg, which deletes both tables **in one transaction** so a retried sweep
  never finds a selection surviving its ownership history.

## 5b. The save (`Decorate`, plan 72)

`Decorate(ctx, scope, Selection) ([]OrnamentSelection, int, error)` in `decorate.go`. `Selection` is
`map[OrnamentKind]OrnamentID` — a **complete** state, not a patch, where an absent or empty id means that kind's free
default. In order:

1. **Validate before any write** — every non-empty id must resolve in the catalog **and** its kind must be the one it
   arrived under (`ErrUnknownOrnamentID`). A kind mismatch is refused, because the field an id arrives on is part of
   the claim.
2. **Open one transaction** (`InDecorateTx`). Its surface (`DecorateTx`) exposes the ownership list, the ownership
   insert, the selection list, the selection upsert and the selection delete — and **no ownership delete**, so a refund,
   an expiry or a re-purchase is not something the save could get wrong: it cannot express them.
3. **Classify** against the caller's ownership. An unowned `ACHIEVEMENT` row is refused here
   (`ErrOrnamentNotPurchasable`) rather than priced; an owned one is free to wear.
4. **Acquire** each unowned purchasable id. `InsertOrnamentOwnership` returns whether **this statement** acquired the
   row — `ON CONFLICT DO NOTHING` means an affected count of 0 is "already owned". That boolean, not a preceding read,
   is the authoritative newly-acquired set: two concurrent identical saves serialize on the primary key and the loser
   is charged nothing.
5. **Price** the acquired rows from the catalog. Zero acquired ⇒ zero charge and the spend leg is skipped entirely, so
   re-selecting what you own writes no ledger row.
6. **Spend** through `SpendGate` (only when the total is positive), on the save's own transaction.
7. **Apply** per kind: upsert a non-empty id, **delete** the row for an empty one. Absence stays the single
   representation of a default, so the two representations cannot drift.
8. **Record** the counter facts — and only if something changed, so re-saving cannot farm one.
9. **Return** the confirmed selection (resolved exactly as the read resolves it) and the charge.

The ledger dedup key is `"ornament_purchase:" + hex(sha256(<length-prefixed sorted acquired ids>))`, mirroring
`spendDedupKey` in `cmd/api/twinkle.go`. Single-use by construction: ownership is permanent, so the same set can never
be acquired twice; a retry folds onto the same key.

**The refusal names the item.** `store.InsufficientTwinkle` carries the economy's own `cost`/`eligible`/`shortfall`
(forwarded by the composition-root adapter, never recomputed) plus the one thing only the catalog knows: the blocking
`ornament_id`, found by filling the acquired set cheapest-first against what was available. BE-only — a refusal detail,
mirrored nowhere.

**The spend leg** is `storeSpendGate` in `cmd/api/store.go`: it resolves the ledger store from the `EconomyTx` carrier
(`DB() dbgen.DBTX`, the `memory/pg` accessor pattern) so the debit joins the save's transaction, maps onto the shipped
`twinkle.PurchaseSpendIntent(amount, dedupKey)`, and translates the denial back into `store`'s vocabulary. One ledger
row **per save**, not per ornament; `twinkle` learns an amount and a key, never what was bought; `store` never reads a
balance.

**Achievement facts** go through `AchievementRecorder` (a counter key and a delta, nothing else — no memory id, mood or
text field exists on it): `decoration_saved` +1, `ornament_owned` = the count after the save, and
`ornament_kind_decorated:<KIND>` +1 per kind whose applied id actually moved. The family member is built from the enum,
never from input. `NoAchievementRecorder` is the shipped default.

## 6. The contract (`cosimosi.store.v1`)

Two unary `NO_SIDE_EFFECTS` reads plus `Decorate`, the one mutation — deliberately not `NO_SIDE_EFFECTS`, so it needs
no cache classification at all. `DecorateRequest` carries one named id field per kind (a duplicate or unknown kind is
unrepresentable) and **no amount, price or total**: the charge is derived from what the save acquired, so a stale or
tampered client total cannot change what is billed. The two reads are classified exactly once each in
`packages/client-cache/src/http-policy.ts` as user-scoped GET with `sharedCdn: false` — the production transport hard-fails on a missing, duplicate or
proto-incompatible classification before I/O, which is the guard; no runtime check is written (§2.7).

The wire's **shape** is the [P7]/[V10] guard, and `internal/store/rpc/server_test.go` asserts it on the descriptors:
no field named `user_id`, `achievement`, `color`, `size`, `brightness`, `seed` or `params` anywhere in the file; no
inventory-shaped message; no equip method. `Ornament` carries exactly
`{ornament_id, kind, acquisition, price, owned, selected}`.

## 7. The catalog↔registry drift guard

`internal/store/testdata/ornament-ids.json` lists every published id per kind plus each kind's default. **One file,
read by both runtimes** — `internal/store/catalog_test.go` asserts the Go catalog against it, and
`packages/3d-renderer/src/assets/ornament-ids.test.ts` asserts the two registries and their defaults against it (plus
that the `emotion` skin's authored `sky.effect` is the default background). A renamed or dropped registry key therefore
fails a test on each runtime, and there is no second copy to keep byte-identical.

The lists' lengths are derived from the registries on the FE side and from the catalog on the Go side — never asserted
as a number.

No pure function in this context mirrors TS↔Go and none should: a price is a lookup performed once, server-side, and
`owned`/`selected` are set membership over rows only the server holds. The duplicated artifact is _data_, so the guard
is a fixture rather than a golden math pair.

## 8. The panel's lifecycle (plan 73)

**The preview is kept nowhere.** No `persist` middleware, no URL parameter, no server write — so a reload, a route
change, a crash, a sign-out and a user switch all restore the confirmed selection _by construction_ rather than through a
handler someone has to remember. `resetStoreUserState()` is registered in `@cosimosi/auth`'s shared reset registry, so
both apps get scope-change revert for free. `preview()` is a **no-op while `previewActive` is false**, so nothing outside
an open panel can install one.

**The machine's transient states are the guarantee.** `committing` and `reverting` are states, not transition actions, so
there is no path from an open panel to `closed` that skips one of them — a panel cannot be closed without either
committing what it previewed or putting it back. `saving` carries no `CLOSE` at all, so a resolved save can never land on
a panel that has moved on. The context holds a phase and the last failure reason; no ornament id enters it.

**A boot read never disturbs a live preview**: `adopt()` updates `confirmed` (what a revert will return to) and leaves
`previewed` alone while the panel is open.

**One translation point** (§3.4): the canvas widget reads `previewActive ? previewed : confirmed`, resolves each id to a
registry key, and hands the two keys to `SkySphere` and `StarLayer`. `widgets/decoration-panel` never imports the
renderer — it installs a preview and this reads it. A sky change repaints in place; a shape change remounts only the star
layer through its existing key.

**The save commits from the response.** `useSaveDecoration` promotes the server's returned selection (never the request),
then invalidates catalog, selection and balance rather than writing any cache (§3.2). It reads the auth facade's snapshot
at **resolve** time, so a save that lands after a user switch resolves to null and commits nothing.

**The boot gate waits on both per-user reads** — mood colours and the applied selection — because entering on the
authored defaults and then jumping to the user's own choices would make every sign-in flicker. An error settles a read
too: unreachable choices mean entering on the defaults, not waiting behind a gate that will never open.

## 9. Composition root

`cmd/api/store.go` builds the service over the shared pool (`newStoreService`), exposes the sweep leg
(`storeWithdrawalPurger`) and registers the handler (`storeServiceOption`). The store service is built **before**
account so the withdrawal composition can take its purge leg; the edge is one-way. `cmd/api/worker.go` registers the
same leg, because the sweep runs in the worker — a purger present in the API but missing there would leave store rows
behind a hard-deleted account. `cmd/api/withdrawal_integration_test.go`'s coverage test parses the migrations for
per-user tables and requires each to be seeded and purged, so a new store table cannot be added without its purge.
