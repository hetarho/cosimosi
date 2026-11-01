# SOCIAL social
> r1 | sending a star to a friend and browsing a public universe are deferred: not offered, while the async one-way share model and the `sharing` seam they will land in stay reserved

## decisions
- SOCIAL-1 [o] sending a star to a friend is not offered: no share table, RPC, UI or job exists ← social is deferred past this release →=PROD
  - when built, the share unit is one `EpisodicMemory`: never a neuron, a synapse, a diary or a whole universe
  - a share hands the recipient a read-only snapshot of that one memory, sender → recipient →!SOCIAL-3
  - star sharing is not the friend invite →=SOCIAL-4
- SOCIAL-2 [o] browsing a public universe is not offered: no route, read or view exists ← it would display what star sharing produces →!SOCIAL-1
  - when built, it is a read-only render of the subset another user shared, opened through one specific share handle →=SOCIAL-11
  - no discovery: no directory of public universes, no feed, no follower graph, no notification
- SOCIAL-3 [o] any social feature is async and one-way: a share is a snapshot handed sender → recipient and consumed on the recipient's own schedule
  - no live subscription, two-way sync, shared editing, comment or real-time co-presence; multi-user real-time collaboration is a recorded non-goal →=PROD
  - no server-streaming transport for it →~ARCH
- SOCIAL-4 [o] the friend invite is not social sharing: inviting a friend to join, with Twinkle for both sides, is a live feature owned elsewhere; star sharing neither depends on it nor overlaps it →=ACCT-8
  - its earn path →=TWINK-3; its abuse guard →=TWINK-6
- SOCIAL-5 [o] the reserved backend home is a new `internal/sharing` bounded context with its own `sharing.v1` service, a peer of `internal/memory`, never columns on `episodic_memories` or RPCs on `MemoryService` ← the memory aggregate then keeps no single-owner assumption a bolted-on share column would contradict →=ARCH
  - it will own share grants only (who shared which memory with whom, one way), never a copy of the memory aggregate
  - a grant references `episodic_memory_id` and its owner `user_id` by id; memory facts are read through a consumer-owned port bound at `cmd/api`
  - `sharing` never imports `internal/memory` internals, and `internal/memory` never imports `sharing`
  - neither the context nor the service exists yet
- SOCIAL-6 [o] `GetUniverse` stays strictly self-scoped: its request carries no owner, user or public field, and a public universe never reuses it ← a widened own read would let a caller name any user's universe →!ACCT-1
  - a public read will be a separate grant-scoped `sharing.v1` read, `NO_SIDE_EFFECTS`, returning the `GetUniverse` DTO shapes (memories, neurons, synapses, `universe_time`: stored facts only, no positions) →~SOCIAL-5
  - the FE mappers then serve both reads unchanged
- SOCIAL-7 [o] no read returns another user's memory content: every product query is scoped to the authenticated user, and sharing will add a new grant-mediated read, never loosen an existing scope →!ACCT-1
  - guard: `pnpm lint:persistence` refuses any cross-user statement outside its named allowlist (queue claims and maintenance, payment-key dedup, invite settlement, admin aggregates), none of which returns memory content
  - the memory aggregate is referenced by id across a boundary, never copied into another context or another user's rows →~MEM
- SOCIAL-8 [o] whatever is shared stays read-only downstream: viewing a shared star or a public universe causes no recall, reconsolidation, decay write, clock advance, deletion or `Diary` change in the owner's universe →!INV-2
  - viewing never advances anyone's universe time →~TIME-3
  - revoking a share removes the grant only, never the memory →!INV-1
  - a share is never a live handle into the owner's aggregate →~INV-8
  - a shared view gives the viewer no write path, into the owner's universe or into their own; recalling a shared star into one's own universe is not reserved
- SOCIAL-9 [o] no position is shipped or stored for a share: the viewer's client re-lays out the shared graph with its own force-sim from the stored facts →!INV-5
  - a public-universe viewer never receives the owner's `Diary` or provenance →~INV-2
- SOCIAL-10 [o] the meaning layer stays the owner's across users: a viewer sees the owner's stored emotion honestly and cannot re-emotion or recolour it →!INV-11
  - colour = the owner's emotion through the viewer's own mood→colour mapping →=MOOD-6
  - brightness, strength and decay derive from the shared facts at the shared `universe_time` with the existing read-time functions; social adds no FE↔BE parity surface →~VIS
- SOCIAL-11 [o] a public universe is the universe render in a read-only mode, not a new engine: navigation stays on and every write affordance is absent →=VIS
  - on: zoom, rotate, pan, focus, fly →~VIS-0
  - absent: launch, recall, letting-go, deletion, decoration and mood-colour editing; the star detail opens as a read-only projection (meta, shape, colour) with no recall, provenance or original-diary action
  - render seam: the render layers of `@cosimosi/universe-render` and `buildUniverseGraph` take a `GetUniverse`-shaped snapshot (the demo already renders its own fixture snapshot through them), while `useUniverseScene` is bound to the own `GetUniverse` read; a read-only mode brings its own source, never a widened own read →!SOCIAL-6
  - write actions stay compositional: the star detail panel emits every action as a host-supplied intent and performs none itself, so a read-only host withholds them instead of forking the widget →=RECALL
- SOCIAL-12 [o] FE placement is reserved by name only: a `features/share-star` slice over a `sharing` entity mirror with its affordance on the star detail panel, and `pages/public-universe` (web) / `PublicUniverseScreen` (mobile) addressed by a share handle behind the auth gate →=ARCH
  - web and mobile will mirror each other like every universe surface
  - the route sits behind the auth↔universe gate →=AUTH
  - none of it exists: no slice, entity, page, screen or route-registry entry

## constraints
- no `values.yaml` key is reserved: share limits, expiry or a Twinkle cost, if a build decides any, go under a future `sharing.*` group
- a build still decides the transport (link or in-app), consent and visibility, expiry, revocation, any cost and the snapshot's exact fields, including whether provenance or the original diary travels with a single-star share; nothing here fixes them

## chg
- r1 261102 initial
