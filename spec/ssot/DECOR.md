# DECOR customization & decoration
> r1 | what a user may customize and what they may never buy: the emotion-palette guardrails and 우주 꾸미기 (the ornament catalog, the atomic `Decorate` save, the over-universe decoration panel)

## decisions
- DECOR-1 [o] the user can change the mood ↔ colour mapping; the product ships a good authored default plus the means to change it ← colour perception differs between people and cultures
  - the change is a free per-mood preference (`MoodColor`) on its own surfaces, the first-signin colour screen and My page →=MOOD-9
  - the editing surface offers presets plus a bounded free picker →=MOOD-15
  - it never goes through the decoration panel and is never an ornament →!DECOR-10
- DECOR-2 [o] guardrail: the palette may change which colour a mood shows, never the meaning "colour = emotion" and never any star's emotion →!INV-11
  - a palette never overrides a stored mood, never decouples colour from emotion, and never feeds position, strength, connection or forgetting →=MOOD-6
  - emotion still never drives position or connection →~INV-3
- DECOR-3 [o] valence–arousal axis consistency (pleasant reads warm, unpleasant reads cool) is recommended, so a free palette keeps carrying emotion information; it is never enforced
  - the authored tables follow it and are test-checked against `palette.axis_warn_valence_threshold` →=MOOD-8
  - a user's own choice is never axis-checked, warned about or blocked; the editor warns only on legibility risks →=MOOD-17
- DECOR-4 [o] customization reaches only the non-meaning staging layer, as 우주 꾸미기 over a closed set of five `OrnamentKind`s; a star's position, strength and colour = emotion are inviolable →!INV-11
  | kind | surface | renderer registry | id prefix |
  |---|---|---|---|
  | `BACKGROUND` | the sky effect that shades the emotion sky | `SKY_EFFECTS` | `background.` |
  | `STAR_SHADER` | the body shape a memory is drawn as | `STAR_SHAPES` | `star_shader.` |
  | `GIST_SHADER` | the body shape its gist is drawn as | `GIST_SHAPES` | `gist_shader.` |
  | `MOTE` | one decorative mote's look | `BACKDROP_MOTES` | `mote.` |
  | `MOTE_FIELD` | the space motes are scattered through | `BACKDROP_FIELDS` | `mote_field.` |
  - bloom, camera (fov) and the bare-night clear colour stay scene defaults of the skin (`rendering.active_skin`) outside the catalog, in every kind and permanently ← a lower bloom threshold makes every star read brighter, which visually undoes forgetting →~FORGET-15
  - no theme, effect or camera-mood customization exists beyond the five kinds
  - nothing meaning-bearing (position, strength, emotion, forgetting stage, gist stage) is expressible as a kind; a feeling's colour is not a kind →=DECOR-10
  - the set is closed at once in the Go enum, the DDL CHECK and the proto: a sixth kind needs one reviewed change to all three
  - a kind names the surface, never the look: the renderer nouns (`SkyEffectKey`, `StarShape`, `GistShape`, `BackdropMote`, `BackdropField`) never appear in Go, DB or proto →=UL
- DECOR-5 [o] decoration is a panel over the universe page, never a page of its own: a sheet at the right edge on a wide screen, the lower third on a narrow one, with the universe visible and camera-interactive beside it ← the point of opening it is to watch the change land in the place it changes
  - no scrim, no focus trap, no Escape binding: hosted by `Sheet`, which has no scrim, overlay or modal prop, never by `Dialog` →=UI
  - the renderer never remounts to show a choice; only the changed layer rebuilds →=VIS
  - entry: one restrained affordance (`store_open_action`) in the HUD's existing row; it opens the panel through the one-slot `useDecorationRequestStore` signal (a widget never imports a widget)
  - the bottom-sheet shape (narrow web, mobile) wears a handle: dragging resizes, a tap collapses and reopens, a pull past the short end closes like ✕ (reverting); the wide shape has none
  - a save in flight disables close (`closeDisabled`) but still allows resizing
  - mobile answers an open request only while the universe screen is focused; losing focus closes the panel, reverting it
  - no decoration lives anywhere else: My page offers no background, shader, camera or effect control →~ACCT-9
- DECOR-6 [o] the whole catalog, owned and unowned, is listed and selectable, and selecting a row applies it at once to the user's real universe as a preview ← see it, then buy it, never buy to see
  - one `GetCatalog` read answers every row; no owned-only read exists →=DECOR-16
  - groups in one scroll in kind order (`store_group_<kind>_title`): no tabs, no owned filter, no sort or badge by ownership
  - a row shows a name and its price, a name and the achievement line, or a name alone: no thumbnail, blurb or swatch, because the universe is the preview
  - names are client-side by id (`store_ornament_<kind>_<key>`, `@cosimosi/store/i18n`), written out per id and pinned to the id fixture; the server sends ids only
  - the live choice wears the selected treatment, and a price stays shown while its row is previewed
  - until the selection read lands each kind shows its free default, the picture an undecorated universe shows
  - the preview reaches the scene through `useWornOrnaments()`, the one translation point →!DECOR-20
- DECOR-7 [o] no 보관함, inventory or equip concept exists: the user has one world, picks from one list and saves; ownership shows only as the presence or absence of a price
  - the row view model carries the cost discriminant `none | price | condition` (`ornamentCost`) and no `owned` field
  - `OrnamentOwnership` and `OrnamentSelection` are internal data, never UI vocabulary
  - contract guard: `store.v1` has no inventory-shaped message and no equip method (descriptor test `internal/store/rpc/server_test.go`)
  - vocabulary guard: `pnpm lint:language` refuses `equip`, the game-inventory sense of inventory, `장착` and `보관함` across apps and packages; no `inventory_*` or `equip_*` i18n key exists
- DECOR-8 [o] the floating save button is purchase plus apply as one atomic operation, `Decorate`; it shows the stardust total of the selection's unowned items, and closing without saving restores the preview
  - label: `store_save_action_priced` with the total when something would be bought, the bare `store_save_action` otherwise; the total is advisory →=DECOR-22
  - insufficient balance makes the save impossible and names the item that is short →!DECOR-18
  - the transaction →!DECOR-17; the preview lifecycle →!DECOR-20
- DECOR-9 [o] ornaments are paid with `GENERAL` Twinkle only, never `SMALL`; a purchase is permanent ownership with no refund, rental, expiry or re-purchase →~TWINK-8
  - spend guards: `store.PurchaseSpend` has no kind or tier field; `PlanSpend` gives a purchase a zero `SMALL` draw; the ledger CHECK `twinkle_ledger_entries_purchase_general_only` refuses an `ornament_purchase` row with `from_basic ≠ 0` (both in the Twinkle context) →~TWINK
  - decoration spending can never eat the day's recall allowance →~TWINK-5
  - the panel reads only the `GENERAL` balance from the shared Twinkle mirror (no second `GetBalance`); `SMALL` appears nowhere in it
  - a price is a function of the kind, resolved server-side: `store.background_price`, `store.star_shader_price`, `store.gist_shader_price`, `store.mote_price`, `store.mote_field_price`; graded by what a row touches, bodies dearest and the mote cheapest
  - no per-row price is representable (`Ornament` has no price field); `FREE` and `ACHIEVEMENT` rows report 0; the client never holds the price table
  - ownership is acquired once per `(user_id, ornament_id)` (`ON CONFLICT DO NOTHING`): a replayed purchase or grant acquires nothing more and never overwrites the original acquisition path
  - Twinkle is the only payment: no real-money or store-receipt purchase path exists →=TWINK
- DECOR-10 [o] a feeling's colour is not decoration: the per-mood colour preference (`MoodColor`) is free, changeable at any time on its own surface, and has no catalog id, no ownership and no price key, nor may it ever have one →~MOOD-9
  - there is no `PALETTE` kind, no palette id and no named palette set; stardust buys only the five staging kinds →!DECOR-4
  - the DECOR-2 guardrail applies unchanged →!INV-11
  - a feeling's colour is never an achievement reward →~ACH-3
  - one home each: what the universe wears is `ornament_selections`, what a feeling looks like is `mood_colors`; they describe different things and cannot disagree
- DECOR-11 [o] some ornaments are achievement-only: listed like any row, never buyable at any price, previewable while unmet, and unsavable until owned
  - exactly two: `background.floating-lines` and `star_shader.spire`, at most one per kind; a kind gets one only when a capstone pays it →~ACH-3
  - an unowned one shows `store_condition_locked` where a price would be and reports price 0; the line does not name the achievement
  - the save verdict `locked` disables the save with `store_locked_notice`; the server refuses it independently (`STORE_ORNAMENT_NOT_PURCHASABLE`)
  - once granted it is owned and free to wear like any owned row
  - direction is one-way: the achievement names the ornament id, `store` never names an achievement (no field anywhere); `cmd/api/catalog_consistency_test.go` pairs the `ACHIEVEMENT` rows 1:1 with the ornament rewards →=ACH-30
  - the grant is `store.GrantOwnership(id, ACHIEVEMENT)` behind the achievement context's `OrnamentGranter`, bound at `cmd/api`; refused for an unpublished id or one whose catalog acquisition differs (`ErrAcquisitionNotGrantable`); a replay grants once
- DECOR-12 [o] an ornament sells a render-parameter id and nothing else: no purchase, achievement or selection may move a star, change its brightness or size, recolour its emotion, reshape its seed, or lift a faded memory back over the bloom threshold →!INV-11 →~VIS-10
  - the catalog row (`Ornament{ID, Kind, Acquisition}`), both tables and every `store.v1` message carry ids and enums only: no colour, size, brightness, seed, position, label, blurb, asset URL or free-form parameter field, and no JSON column
  - descriptor guard: no field named `user_id`, `achievement`, `color`, `size`, `brightness`, `seed` or `params` anywhere in `store.v1`
  - renderer guard: each kind's builder receives the meaning channels as pass-through inputs with no writable handle; the star-shape options carry `animate` alone (no tint, brightness, seed or layer scale) and `EMISSIVE_GAIN` is not a shape field →=VIS
  - `GIST_SHADER` is one gist look for the whole universe, never per memory: it changes how a gist is lit, never which gists exist, how high they rose or their colour →~CONSOL-17
  - backdrop count and radius are the device budget, never a selection; a mote field may empty the sky but never raise the instance ceiling →=VIS
  - a sky effect only shades the emotion sky; its colours and shares come from the universe's emotions →=MOOD-4
  - each kind's key reaches the renderer as a plain string and resolves inside the owning registry, a retired key falling back to that registry's declared default (never its first row) →=VIS
  - the decoration panel imports no renderer and no memory-domain entity; one bridge in the canvas widget turns the worn ids into registry keys →=VIS
- DECOR-13 [o] the catalog is Go code (`internal/store/catalog.go`), not a table, and its membership is a rule: one row per id the five renderer registries publish, with no count declared or asserted anywhere
  - id = `<lower(kind)>.<registry key>` (`background.grainient`); the server reads only the prefix, the client splits on the first `.`
  - the map literal makes a duplicate id a compile error; a prefix naming no kind panics at first import
  - `Ornaments()` is the one enumeration, in one sorted order
  - acquisition: each registry's own default is `FREE`, the two capstone rows are `ACHIEVEMENT`, every other row is `PURCHASE`
  - drift guard: `internal/store/testdata/ornament-ids.json`, one file read by both runtimes (`catalog_test.go`, `packages/3d-renderer/src/assets/ornament-ids.test.ts`, the names test in `@cosimosi/store`); lengths derived, never asserted
  - a new look in a registry becomes a purchasable ornament (with its name key) by construction, and must fit the renderer's budgets (`rendering.star_shape_triangle_budget`, the backdrop triangle ceiling) →=VIS
  - no TS↔Go golden math exists or may: a price is one server-side lookup and the shared artifact is data
- DECOR-14 [o] each kind has exactly one free row, its registry's own default, owned by everyone with no ownership row ever written; the absence of a selection row is that default
  | kind | default id |
  |---|---|
  | `BACKGROUND` | `background.grainient` |
  | `STAR_SHADER` | `star_shader.facet` |
  | `GIST_SHADER` | `gist_shader.halo` |
  | `MOTE` | `mote.pinprick` |
  | `MOTE_FIELD` | `mote_field.even` |
  - default ids are contract constants in Go (`Default*OrnamentID`) and in `@cosimosi/store`, each mirroring its registry's `DEFAULT_*`; never values keys
  - the default background equals the `emotion` skin's authored `sky.effect` (asserted in `ornament-ids.test.ts`)
  - no signup grant, no backfill, nothing to migrate
  - reverting a kind to its default is free and keeps what was bought: the selection row is deleted, the ownership row stays
- DECOR-15 [o] storage is two user-scoped tables: `ornament_ownerships(user_id, ornament_id, acquired_via, acquired_at)` keyed `(user_id, ornament_id)`, and `ornament_selections(user_id, kind, ornament_id, selected_at)` keyed `(user_id, kind)`
  - CHECK `acquired_via IN ('purchase', 'achievement')`; the ownership primary key is the dedup key for both acquisition legs →=DECOR-9
  - CHECK `kind` ∈ the five kinds, and CHECK `starts_with(ornament_id, lower(kind) || '.')` with a non-empty key: a selection can never hold another kind's id, a wildcard near-match or a bare prefix
  - `PRIMARY KEY (user_id, kind)` makes exactly one applied ornament per kind a schema fact
  - load-bearing absences: no params, config or JSON column; no `deleted_at`, expiry, quantity or revocation column; no `kind` column on ownerships (the prefix is the only truth); no FK to `users`
  - both constraints are asserted against a real Postgres (`internal/store/pg/store_integration_test.go`)
  - every statement is conjunctively scoped by `user_id` and `pnpm lint:persistence` passes with no `platformTables` or `globalQueries` entry →=ACCT-1
  - ownership is never updated or deleted by the system; the only deletes are the withdrawal purge pair, listed in `hardDeleteQueries` →=DECOR-25
- DECOR-16 [o] reads: `StoreService.GetCatalog` and `GetSelection`, both `NO_SIDE_EFFECTS`, each classified exactly once in `packages/client-cache/src/http-policy.ts` as a user-scoped GET with `sharedCdn: false` →=CLIENT
  - `Ornament` carries exactly `{ornament_id, kind, acquisition, price, owned, selected}`; `owned` = `FREE` or an ownership row exists
  - `GetSelection` answers exactly one entry per kind: an absent row or an unknown or retired stored id coerces to the kind's default ← a read must always answer, so boot is deterministic and a retired look degrades to the free one
  - a write never guesses: an unpublished id is refused (`ErrUnknownOrnamentID`), never coerced
  - `Catalog` reads the selection before the ownerships, so a concurrent save can surface "owned, not yet worn" but never "worn but unowned"
  - no request names a user; scope comes from the authenticated caller
- DECOR-17 [o] `Decorate(selection)` validates, acquires, prices, spends, applies and records in one transaction; any failure leaves no ownership row, no applied change and no ledger row →!DECOR-8
  - the request is the complete selection, one named id field per kind (a duplicate or unknown kind is unrepresentable); empty means the kind's free default, and an explicitly sent default id normalizes to empty
  - no amount, price or total field exists ← a stale or tampered client total must never change what is billed
  - validated before any write: an unpublished id, or one on another kind's field, is `STORE_ORNAMENT_UNKNOWN` (InvalidArgument)
  - an unowned `ACHIEVEMENT` row is `STORE_ORNAMENT_NOT_PURCHASABLE` (FailedPrecondition), refused rather than priced
  - the charge sums kind prices over the rows whose `INSERT … ON CONFLICT DO NOTHING` reported acquiring them in this transaction, never a preceding read, so two concurrent identical saves charge once
  - nothing acquired ⇒ no spend leg and no ledger row: wearing what you own is not a transaction
  - apply per kind: upsert a non-empty id, delete the row for an empty one, so absence stays the single representation of a default
  - `ornament_selections` is written only here, through the save's own transaction handle; no read port carries a selection write
  - the transaction surface `DecorateTx` has no ownership delete: a refund, expiry or re-purchase cannot be expressed
  - the response is the confirmed selection, resolved as the read resolves it, plus `spent_twinkle`; a save that changes nothing is a quiet successful no-op
  - no scope ⇒ `STORE_SCOPE_REQUIRED` (Unauthenticated) →=ERR
- DECOR-18 [o] a save's debit is one `ornament_purchase` ledger row through the consumer-owned `store.SpendGate`, joined to the save's transaction →!TWINK-7
  - amount = the whole charge, never one row per ornament; dedup key = `ornament_purchase:` + sha256 of the length-prefixed sorted acquired ids, single-use because ownership is permanent, and a retry folds onto it
  - Twinkle learns an amount and a key, never what was bought; `store` never reads a balance and no response carries one
  - insufficient balance refuses the whole save with `STORE_INSUFFICIENT_TWINKLE` (ResourceExhausted), distinct from `TWINKLE_INSUFFICIENT`; nothing is bought, applied or deleted →~INV-1
  - its metadata carries the save's `cost`, the economy's own `eligible` and `shortfall` (never recomputed), and the short `ornament_id`: the first item that does not fit when the acquired set fills cheapest-first, ties by id
  - a refusal the economy raises without its arithmetic carries `cost` only: no item, no invented shortfall
  - fallback copy `error_store_insufficient` says nothing was saved; the item-specific line is the panel's →=ERR
  - known limit: the dedup namespace is shared with admin grants, so an operator typing a computed purchase key verbatim would make that one purchase free; accepted, as the operator can already grant Twinkle →=TWINK
- DECOR-19 [o] a save reports achievement facts only as counters, through the consumer-owned `store.AchievementRecorder` inside its transaction; the counter keys are the achievement context's →=ACH
  | counter | when |
  |---|---|
  | `decoration_saved` | +1 when the save changed anything |
  | `ornament_owned` | the ownership count after the save (reach) |
  | `ornament_kind_decorated:<KIND>` | +1 per kind whose applied id actually moved |
  - the payload is `(scope, tx, counterKey, delta)`: no memory id, mood or text field can ride along →~ACH-6
  - a family member is built from the kind enum, never from input; a save whose applied ids did not move records none of the three, so re-saving cannot farm progress
  - the service refuses construction without a recorder (`ErrAchievementsRequired`); `NoAchievementRecorder` serves tests and minimal roots
  - `GrantOwnership` reports `ornament_owned` in its own transaction, and a failed report fails the whole grant ← a dropped count has no repair path, while the claim's retry replays the idempotent grant →=ACH
- DECOR-20 [o] the client preview is kept nowhere: `useOrnamentPreviewStore` holds `{previewActive, previewed, confirmed}` in memory, with no persist middleware, no URL parameter and no server write ← a previewed unowned ornament must never survive as a free item; `Decorate` is the only durable write
  - `preview()` is a no-op while no panel is open, so nothing else can install a preview
  - every exit restores the confirmed selection: close without saving, route change or unmount, mobile focus loss, reload, process death, sign-out and account switch (`resetStoreUserState()` in the shared user-state reset registry →=CLIENT)
  - another mutation (a recall, a diary write) neither cancels nor captures a live preview; no `memory.v1` or `twinkle.v1` request carries an ornament id
  - a boot read never disturbs a live preview: `adopt()` updates only `confirmed` while a panel is open
  - every surface that draws decoration reads `useWornOrnaments()` (the preview while open, else the confirmed read `useAppliedOrnaments()`), so precedence is resolved once
  - success commits from the response's selection, never the request, invalidates catalog, selection, balance and achievements, and closes the panel; a save resolving after a user switch commits nothing
  - failure writes nothing, keeps the preview and stays retriable
  - the boot gate adopts `GetSelection` as `confirmed` before the universe mounts, beside the colour read →=MOOD-20
- DECOR-21 [o] the panel's control state is one XState machine, `decorationMachine` (`packages/store`); its context is the last failure reason only →=ARCH
  | state | meaning | exits |
  |---|---|---|
  | `closed` | panel hidden | `OPEN` → `browsing` |
  | `browsing` | open, preview live | `SAVE` → `saving`; `CLOSE` → `reverting` |
  | `saving` | `Decorate` in flight, rows frozen, close inert | `SAVED` → `committing`; `FAILED` → `browsing` |
  | `committing` | transient: the commit stands | `SETTLED` → `closed` |
  | `reverting` | transient: the preview is put back | `SETTLED` → `closed` |
  - no path from an open panel reaches `closed` without `committing` or `reverting`
  - `saving` has no `CLOSE`, so a resolved save never lands on a panel that moved on; only the send that moved the machine may start a request
  - the ids are data (Zustand), the catalog and balance are Query; no ornament id enters the machine
- DECOR-22 [o] the save verdict (`saveVerdict`, `packages/store/src/save-eligibility.ts`) is advisory display arithmetic, checked in order: unchanged, locked, free, shortfall, ready
  - `ready` shows the total; `free` and `unchanged` show the bare save label
  - `shortfall` disables the save and names the short item and the missing amount (`store_shortfall_notice`), by the server's cheapest-first rule, so both point at the same row
  - `shortfall` is claimed only once the `GENERAL` balance is loaded ← an unread balance reads as zero, and the client must not refuse a save the server would accept
  - a server refusal renders through the same line; recovery never points at buying Twinkle
  - the authoritative total is the server's: a client divergence can only mislabel the button, never mis-charge
- DECOR-23 [o] panel copy lives under the `store_*` keys and states what happened and nothing more: plain voice, no sales pressure, no decorative emoji, no ownership words →=UI
  - a refused save says nothing was saved, never a bare "not enough"; a generic line never names an item, since only the panel can turn an id into a name
  - the mood labels come from `moodLabel`, never a `store_*` key →=MOOD-2
- DECOR-24 [o] placement →=ARCH
  - Go: `internal/store`, a supporting context in one package (`catalog.go`, `decorate.go`, `service.go`, `ports.go`, `purge.go`, `errors.go`, `types.go`) plus `store/pg` (the only sqlc and pgx importer) and `store/rpc` (thin handlers); queries in `db/queries/store/`
  - `store` imports no other internal context and none imports it; every edge is a composition-root adapter over a consumer-owned port: the spend gate and purge leg in `cmd/api/store.go`, the ornament granter in `cmd/api/achievement.go`
  - TS: `@cosimosi/store` holds the DTO mirrors, the id ↔ registry-key split, the defaults, the preview store, the machine, the request store and the save verdict; `@cosimosi/store/react` the hooks; `@cosimosi/store/i18n` the names
  - web and mobile run `widgets/decoration-panel` with `features/preview-ornament` and `features/buy-ornament`, mounted by `pages/universe` beside the other over-canvas sheets; they share the package and fork only `ui` and the `Sheet` primitive pair
  - the demo shows the panel's shapes reading names only, never a price, an ownership or the save flow →=DEMO-8
- DECOR-25 [o] withdrawal: `store.PurgeUser` hard-deletes the user's ownership and selection rows in one transaction, the context's only delete →=ACCT-10
  - it is one leg of the sweep, registered in both the API and the worker compositions, since the sweep runs in the worker →~ACCT-27
  - the coverage test (`cmd/api/withdrawal_integration_test.go`) requires every per-user table to be seeded and purged, so a store table cannot ship without its purge
  - during the retention window the platform interceptor rejects the withdrawn scope before any store read; no per-query filter exists →=ACCT
  - a restore inside the window finds the rows untouched: ownership and selection return as they were, and nothing is granted again →~ACCT-24

## flow
- decorate: HUD affordance → `browsing`(select row → preview on the real universe) → save(verdict: shortfall | locked: disabled | else `Decorate`) → `saving`(ok: `committing` → closed | fail: `browsing`, preview kept)
- leave: close | route change | focus loss | reload | sign-out → `reverting` or by construction → confirmed selection

## constraints
- values keys owned here: the five `store.*_price` keys; catalog rows, ids, defaults, acquisition paths and row counts are code
- decoration never reaches a memory: `store.v1` and the decoration panel carry no memory, mood or Twinkle-balance field, and `store` declares no port into `memory` →!INV-11

## chg
- r1 261102 initial
