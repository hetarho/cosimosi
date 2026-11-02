# CLIENT client platform
> r2 | the frontend substrate web and mobile share: provider composition, the server-data cache, the user-scope reset, the state-machine foundation, the i18n seam, web routing and the mobile shell

## decisions
- CLIENT-1 [o] each app root composes one provider stack in a fixed order, providers outer and routing inner; feature slices never create long-lived providers →=ARCH
  | app | order, outer → inner |
  |---|---|
  | web | observability → error boundary → i18n → locale render boundary → toast → auth → client cache (transport, QueryClient, scope boundary) → router |
  | mobile | observability → error boundary → i18n → locale render boundary → theme → toast → auth → client cache → machine actors → `NavigationRoot` |
  - observability is outermost so the error boundary reports to it; the toast queue sits above auth so an auth error can toast
  - every provider accepts fakes, so both shells render in host tests without Supabase, an API or a device
  - mobile wraps the stack in `SafeAreaProvider` and `StatusBar` in `App.tsx`
- CLIENT-2 [o] web and mobile consume the same pure packages (API client, cache, values, machines, i18n, tokens); there is no mobile-only data, state or i18n library →=ARCH
  - platform code lives in app providers, `shared/native`, `shared/config` and `ui` hosts; feature and domain slices never touch native concerns
  - routing parity is disciplinary, not shared code: no shared route-contract package, since the libraries and param shapes differ
- CLIENT-3 [o] TanStack Query with connect-query owns server data; each app root owns exactly one QueryClient, and each test creates an isolated one (`createClientCacheTestContext`)
  - defaults come from `client_cache.default_stale_ms`, `client_cache.default_gc_ms` and `client_cache.default_retry_count`, never hard-coded
  - Zustand holds client-local collections and read mirrors, refs hold per-frame buffers, machines hold control state →=ARCH
  - no persisted offline cache, no polling, no server streaming, no background sync
- CLIENT-4 [o] cache keys derive from connect-query service and method descriptors plus the normalized input; feature code never hand-builds a string key where a generated helper exists
  - a composite key is exported from the owning slice's `api` segment
  - user identity enters only through the auth/transport boundary, never as a key part; the scope reset separates users →!CLIENT-10
- CLIENT-5 [o] an idempotent unary read (`NO_SIDE_EFFECTS`) may travel as HTTP GET, every write stays POST, and user-scoped data is never cacheable on a shared or public CDN →=ARCH
  - each service declares one policy list (`platform`, `memory`, `twinkle`, `account`, `store`, `achievement`, `admin` `RpcCachePolicies`), aggregated into `clientCacheRpcCachePolicies`; a write needs no entry
  - each GET-eligible method appears exactly once; every authenticated read uses `userScopedUnaryReadPolicy` (private GET); `PlatformService.Ping` is the only public read
  - guards: `defineRpcCachePolicy` refuses GET for a non-idempotent method and a shared CDN for user-scoped data; `createClientCacheRpcPolicyInterceptor` asserts coverage against the generated descriptors when the transport is built and preflights each request before Connect's POST→GET transform, so a missing or duplicate entry fails before any I/O
  - a production-composition test drives the real transport through the auth, cache-policy and telemetry interceptors
- CLIENT-6 [o] each product mutation owns its optimistic lifecycle beside the state it changes: cancel the affected reads, snapshot, patch, call, roll back on error, invalidate or refetch on settle
  - no generic optimistic-transaction helper exists until a real Query-owned mutation needs one
  - `setClientCacheData` (test support) treats an `undefined` update as exact-query removal
- CLIENT-7 [o] render-loop data never enters the Query cache: `assertClientCacheData` rejects ArrayBuffer-backed buffers, also inside `Map`/`Set`, and stops circular graphs with a bounded error; protobuf `bytes` (`Uint8Array`) stay valid server data
- CLIENT-8 [o] a Zustand read mirror carries what its Query reads returned; when several reads on one screen feed one mirror, exactly one read owns it →=DIARY-15
  - the owning read's settlements replace the owning segment; any other enabled read replaces its own contribution segment, including when it settles empty
  - an owner settlement never erases the contributions; a disabled read writes nothing
  - lookups by id read the union of both segments, so a confirm that lists affected items finds every one the screen shows (`useDiaryStore`, `syncDiaryArchiveMirror`)
- CLIENT-9 [o] a write invalidates every read it changes through the read's input-less key, which matches every input variant; nothing polls
  - a recall that moves the clock invalidates the cached `SyncStatus` and `GetUniverse` →=TIME-17
  - the recall flow (`RecallFlowSheet`) invalidates the whole `MemoryService`; the whole-diary recall also invalidates balance and achievements and refetches `SyncStatus` at its decision point →~DIARY-22
  - release, restore and letting go invalidate the archive and calendar keys →~DIARY-16
- CLIENT-10 [o] a change of the auth scope key is a hard client-state boundary: `SessionScopeBoundary` withholds the routed subtree until the old scope's client state is cleared, then commits the new scope ← a loaded snapshot, draft, target or action of user A must never render or fire under B's credentials →~AUTH
  - the scope key is the session user id, or `anonymous` (`authScopeKey`)
  - the change callback in each app's client-cache provider clears the QueryClient, drops every `SESSION_SCOPED_TOAST_OWNERS` entry, then runs `resetUserState`
  - it is a change callback, not an effect keyed on the identity: it fires once per real change, never on mount and never during render, so a development double-effect cannot discard notices the incoming session queued →~ACH-5
  - the toast queue sits above auth, so unmounting a feature host alone would leave its queued entry for the next user →=UI
  - an injected QueryClient takes part but stays caller-owned; an owned one is also cleared on unmount
  - persisted data is never deleted; this is the presentation-side complement of server user scoping →=ACCT-1
- CLIENT-11 [o] every scope change runs one ordered set of reset legs on both platforms: `resetUserState` (`@cosimosi/auth/user-state`) first advances the user-scope generation, then runs the app's product legs, then auth's own leg, then the app's `locale` leg
  | leg | clears |
  |---|---|
  | `universe` | read mirrors (episodic memories, neurons, synapses, clock, diaries); released groups; recall, open-diary, pending-fly, spotlight and deletion targets; latent-consumed marks, awaken registry; advance announcement, sweep and sky rate; launched-neuron hand-off; diary, proposal, recall and deletion drafts; a pending time-sync consent, settled as `cancel` |
  | `twinkle` | balance mirror, earn-request channel |
  | `palette` | active mood palette, back to the default |
  | `store` | ornament preview, decoration request channel |
  | `sequence` | anchor registry |
  | `onboarding` | pending start or replay request, signal channel →~ONB-24 |
  | `signup-completion` (account) | the one-shot signup-completion flag →~ACCT-33 |
  | `locale` (per app) | web: stored choice, then browser negotiation; mobile: device locale |
  - app composition lists the product legs (`WEB_USER_STATE_RESETS`, `MOBILE_USER_STATE_RESETS`) in the same order on both apps, each in `app/providers/user-state-resets.ts`; `@cosimosi/auth` owns only its session state and depends on no product package
  - each package owns one public reset seam; composition calls seams, never package internals
  - the generation advances before any leg, so in-flight completions are invalidated whichever legs an app registers →!CLIENT-13
  - every package-level store or mutable module value is either cleared by a leg or listed as device-scoped; a sandbox that clears product stores (the demo) calls the store seams without advancing the generation
- CLIENT-12 [o] every module-global user-owned store or deferred-action channel registers its reset in its package's seam and extends the reset regression tests; component-local state needs none, since the boundary unmounts it
  - excluded on purpose: the pending-invite holder survives the anonymous→user transition and an OAuth round trip, clearing only when `SignUp` consumes it or an established profile enters →=ACCT-34
  - excluded on purpose: the universe view mode (`useUniverseViewStore`, pinned or free) is a device preference kept across account switches until the runtime restarts →=VIS
  - session-scoped toasts live in React context, so the change callback drops them outside the legs →!CLIENT-10
- CLIENT-13 [o] an async completion that writes user state captures its account generation and its owner, and is dropped if either changed before it settles
  - `useCompletionScope` (`packages/universe`) fences release, restore and let-go completions; paid-action sessions fence recall completions by target and attempt →=RECALL
- CLIENT-14 [o] XState v5 models exclusive control phases only; data stays in Query, Zustand or refs and is selected by id →=ARCH
  - a two-state open flag or a preference is local state or a store, not a machine
  - no global event bus, no animation timeline system
- CLIENT-15 [o] a machine lives where its control flow belongs, in `<name>.machine.ts` with named exports (machine, factories, `<Name>Event`/`<Name>Snapshot` types), no default export and no wildcard barrel
  | kind | home |
  |---|---|
  | app-wide lifecycle | `apps/{web,mobile}/src/app/model` |
  | feature action | `features/<verb>/model` |
  | entity control | `entities/<noun>/model` |
  | product machine both apps run | the product's pure package (`packages/universe`, `sequence`, `store`, `auth`) |
  | generic pattern | `packages/state-machine` |
  - a web+mobile pair imports its machine from the package and forks only its `ui` hosts
- CLIENT-16 [o] machine context holds ids and control metadata only: ids, mode or status, control timestamps, small error strings, a monotonic epoch or attempt counter
  - never: server collections, Query data, Zustand snapshots, graph or coordinate buffers, Supabase sessions or tokens, functions, callbacks, refs
  - guard: `context-rule.test.ts` asserts catalog snapshots are JSON-serializable with documented fields only; every machine keeps deterministic transition tests (`<name>.machine.test.ts`) beside it
- CLIENT-17 [o] a machine is a pure function of state and event: it never reads a clock, and a late async result is refused by an echoed counter, not by caller discipline
  - time arrives in events (`panelMachine`'s `openedAt`); timers live in the host
  - catalog `asyncCommandMachine` (idle, submitting, succeeded, failed, cancelled): `RESOLVE`/`REJECT` echo the `attempt` they observed; the counter never resets, so a stale resolution after a cancel or reset mismatches
  - catalog `panelMachine`: closed, open, loading, ready, error; `sessionMachine` is the auth lifecycle →=AUTH
- CLIENT-18 [o] React code binds actors only through `@cosimosi/state-machine/react`, imported directly by both apps with no app-local re-export; the package root stays React-free for tests, workers and frame loops
  - `useActorRef` for a stable reference, `useSelector` with a selector defined outside the component (`shallowEqual` for object slices), `useMachine` for small component-owned machines
- CLIENT-19 [o] per-frame code never drives React state: inside `useFrame` the renderer reads `actor.getSnapshot()` from a stable ref →=VIS
  - continuous values (positions, brightness, lerped colours) live in refs or worker buffers, never in machine context or React state
  - machines gate discrete modes only; transitions come from React handlers or the worker boundary
  - the one exception is an edge-triggered latch evaluated in the frame loop, which sends one event per discrete crossing and never one per frame: the navigation rig's `ARRIVED` (`navigation-latch.ts`) →=VIS-45
- CLIENT-20 [o] the app-wide actor mount point is `app/model`: mobile hosts `appShellMachine` (`booting → ready`) through `MachineActorsProvider` as a reserved seam nothing drives or reads; web creates one only when it needs it
  - stack and route selection never read it; the auth gate maps the session snapshot directly →=AUTH
- CLIENT-21 [o] feature machines belong to their feature domains; CLIENT owns only the conventions they follow
  | machine | owner |
  |---|---|
  | `universeTimeMachine` | →=TIME-22 |
  | `starDetailMachine`, `recallFlowMachine` | →=RECALL |
  | `diaryReaderMachine` | →=DIARY-23 |
  | `deletionFlowMachine` | →=DEL |
  | `writingFlowMachine` | →=WRITE |
  | `universeNavigationMachine` | →=VIS |
  | `decorationMachine` | →=DECOR |
  | `sequenceRunMachine` | →=ONB-8 |
  | `demoRunMachine` | →=DEMO-23 |
  | `signupCredentialMachine` | →=ACCT-31 |
- CLIENT-22 [o] every user-facing string is a typed Paraglide message function from `packages/i18n`; copy lives in `messages/en.json` and `ko.json`, every key in both, `en` the base locale →=ARCH
  - compiled output in `packages/i18n/src/gen` is committed (`pnpm gen:messages`) and freshness-checked by `pnpm check:gen` (a second run is byte-identical)
  - the runtime uses the `globalVariable` strategy, with no DOM global, so the same `m.*` runs on web, React Native and Node
  - no server-side, AI or DB-stored translation; blog posts are not localized →=MKT-31
- CLIENT-23 [o] a message key is snake_case and names a UI role, never a domain term; renaming a concept renames its keys, never revalues them in place ← a rename makes every stale call site a compile error, a value edit ships silently
  - a deleted affordance takes its keys with it
  - `pnpm lint:language` scans the catalogues for forbidden synonyms only; rendering words are legitimate inside user-facing copy →=UL
- CLIENT-24 [o] a domain id becomes copy through a `Record` of static `m.*` accessors owned by the domain package (`moodLabel` in `@cosimosi/emotion/i18n`, the achievement copy map), never a key assembled at runtime ← a constructed key is invisible to `gen:messages`, `check:gen` and `lint:raw-strings` at once
  - the wire carries ids and enums only, never a title or label
  - a missing entry has an explicit fallback, never a blank (achievements: `achievement_untitled`) →=ACH-36
- CLIENT-25 [o] product code imports copy only from its app's `shared/i18n` barrel, which re-exports `@cosimosi/i18n/react` and domain projections; a direct `@cosimosi/i18n` import is a lint error outside the platform locale adapters and tests
- CLIENT-26 [o] locale resolution: supported `en` and `ko`, default `en`; `resolveLocale` returns the first candidate that matches (exact, then primary subtag, case-insensitive, `-` or `_`), else the default
  | context | precedence |
  |---|---|
  | signed in | the profile locale (`LocaleBootstrap`, applied in an effect without withholding render) |
  | web | stored choice `localStorage["cosimosi.locale"]` → `navigator.languages` → default |
  | mobile | device locale → default; no durable native preference |
  - negotiation writes only from effects; web syncs `<html lang>`
  - the profile language control applies at once, writes the profile and rolls back on refusal; web also stores the choice →=ACCT-37 →~MKT-6
  - the public landing's switch writes only the web stored choice →=MKT-4
  - a scope change restores the platform negotiation before a new profile takes precedence →!CLIENT-11
- CLIENT-27 [o] a locale switch re-evaluates every mounted message without remounting: `LocaleRenderBoundary` recreates the element tree, so auth, cache, navigation, forms and in-flight mutations survive
- CLIENT-28 [o] no raw user-facing string in UI code: `pnpm lint:raw-strings` fails JSX text with letters and string literals on user-facing attributes (`title`, `placeholder`, `alt`, `label`, `aria-*`, `accessibility*`)
  - out of scope: logs, thrown errors, route ids, structural attributes, `{m.x()}`; tests, generated code and stories by path; a line carrying `i18n-ignore`
  - `pnpm lint:raw-strings:probe` proves the rule catches and ignores what it should
  - design-system primitives take copy as props and own no product copy →=UI; error copy selection →=ERR
- CLIENT-29 [o] web routes with TanStack Router v1: a code-based tree confined to `apps/web/src/app/routes/`, the only code importing `@tanstack/react-router` ← file-based routing scatters route files and fights FSD
  - `pages` and `features` navigate through `routes/navigation.ts` (`Link`, `useAppNavigate`); a route component is a thin app-layer wrapper injecting callbacks (`onExit`, `onOpenReader`) into its page
  - `declare module … Register` makes every `Link`/`navigate` target compile-time checked, the web mirror of mobile's `RootStackParamList`
  - a new product route mounts under the `authenticated` layout, a public one under the root with no `beforeLoad` →=AUTH
- CLIENT-30 [o] the web route table
  | path | screen | access |
  |---|---|---|
  | `/universe`, `/diary`, `/me` | universe, diary reader, my page | authenticated layout →=AUTH |
  | `/admin` | admin console | authenticated, then admin →=ADMIN |
  | `/`, `/login`, `/signup` | the door and its signup mode | signed-out decision →=AUTH |
  | `/invite/$token` | invite capture, replaced by `/signup` | public →=ACCT-34 |
  | `/about` | landing | public, no gate →=MKT-15 |
  | `/demo` | demo sandbox | public, no `beforeLoad`, import-isolated →=DEMO-10 |
  | `/blog/$` | blog-shaped miss page | public; the static blog resolves first →=MKT-33 |
  | `/test`, `/design` | harness, design showcase | diagnostics gate →!CLIENT-32 |
  - an unknown path renders the localized not-found screen; route render errors surface through `ObservedErrorBoundary`
- CLIENT-31 [o] URL semantics: query strings never affect matching; trailing slash is pinned to `never` (the root excepted) to agree with the canonical URLs and sitemap; `/blog/` lies outside this router →~MKT-28
- CLIENT-32 [o] dev-only surfaces are unreachable without the diagnostics flag: `/test` and `/design` throw `notFound()` unless `import.meta.env.DEV` or `platform.diagnosticsSurface` is on, and sit outside the authenticated subtree since they read no product data →=OBS
  - mobile `Diagnostics` and `Test` check the same flag key
  - the diagnostics surface shows locale, theme, session status, API base URL, a live ping, cache size and flag defaults, never tokens or product data
- CLIENT-33 [o] the route seam is also the chunk boundary: what a cold visitor lands on ships in the entry chunk, everything reached later loads dynamically
  | loaded | routes |
  |---|---|
  | static (entry chunk) | `/`, `/about`, `/login`, `/signup`, `/invite/$token`, `/blog/$`, the `authenticated` layout |
  | dynamic | `/universe`, `/diary`, `/me`, `/admin`, `/demo`, `/test`, `/design` |
  - `route-splitting.test.ts` pins the table, so a public page made lazy or a screen made static fails a test
  - `lazyRouteComponent`, never bare `React.lazy`; one module per lazy screen in `app/routes/screens/`; only type imports from a lazy page's barrel
  - `defaultPendingComponent` is the neutral `AuthHold`, so a lazy screen never suspends to a blank frame
  - the layout stays static so no unauthenticated frame renders before `beforeLoad`; `build.chunkSizeWarningLimit` sits just above the largest deliberate chunk
- CLIENT-34 [o] user-editable search params are validated or dropped, never forwarded: an unknown or malformed value falls back to the default view, never a refusal
  - one app-layer file per routed screen (`diary-search.ts`, `me-search.ts`) is the only place URL keys meet the request or screen shape; pages hold no mirror
  - setters take an update function merged against the live search, so two controls in one navigation cannot overwrite each other
  - `/diary` conditions and view keys →=DIARY-20 →=DIARY-24; `/me?tab=` →=ACCT-36
- CLIENT-35 [o] no SSR, no prerendering, no route loaders or Query prefetching; tests build `createAppRouter({ diagnosticsEnabled, initialEntries })` on memory history, await `router.load()` and inject it into `<App router>`
- CLIENT-36 [o] mobile navigates with React Navigation v7 native-stack, confined to `app/navigation/NavigationRoot.tsx` and `routes.ts` (typed `RootStackParamList`, `ROUTES`, the `ReactNavigation.RootParamList` augmentation)
  - routes: `Boot`, `Login`, `SignUp`, `Universe`, `DiaryReader`, `Me` (optional validated `tab` →~ACCT-36), `Diagnostics`, `Test`, `Design`; stack selection →=AUTH
  - module-private route adapters pass callback and data props; product composition lives in mirrored `pages/<slice>`; product code never imports the navigation library
  - `cosimosi://` deep links target authenticated-stack screens only; auth-callback and invite links never reach the route table →=AUTH
- CLIENT-37 [o] native concerns stay at app and shared boundaries: `shared/native` (device locale, secure token storage seam, inbound links, safe-area metrics) and `shared/config` (API base URL, version label, diagnostics flag key)
  - API base URL: web `VITE_API_BASE_URL` → `VITE_API_URL` → local default; mobile injected, else `localhost:8080` (iOS) or `10.0.2.2:8080` (Android emulator)
  - a `*.native` sibling exists only where DOM and RN differ →=ARCH
- CLIENT-38 [o] mobile has a host test gate with no emulator: Jest with the RN preset and Testing Library (`pnpm test:mobile`); the shell smoke test renders the full stack with `createMobileShellFakes`
- CLIENT-39 [o] the universe read is never refetched just because the window regains focus; on refocus past its stale time the client reads `GetUniverseRevision` and refetches `GetUniverse` only when the revision differs from the cached snapshot's ← the full snapshot grows with the account while a revision read stays constant →!MEM-21
  - `GetUniverseRevision` is a `NO_SIDE_EFFECTS` read classified in the memory policy list →=CLIENT-5
  - post-mutation invalidation and an explicit refresh still refetch the full read →=CLIENT-6
  - other reads keep the default focus behavior; mobile wires no focus source

## flow
- scope change: session user id changes → `SessionScopeBoundary` withholds children → clear QueryClient → drop session toasts → `resetUserState`(advance generation → product legs → `signup-completion` → `locale`) → commit the new scope → routed subtree mounts

## constraints
- values keys owned by CLIENT: `client_cache.default_stale_ms`, `client_cache.default_gc_ms`, `client_cache.default_retry_count`; routing, i18n and machines add none
- canonical domain terms are owned by the UL and never become message keys →=UL

## chg
- r2 261103 CLIENT-11✎ generation advance "by the universe leg"→"by `resetUserState` before any leg", signup-completion leg auth→account, +inventory path and store-registration rule ; CLIENT-39+ refocus revision read before the full universe read
- r1 261102 initial
