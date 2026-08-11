# tech: web routing

> As-built rules for `apps/web`'s client-side router. The architectural frame lives in
> [ARCHITECTURE.md](../ARCHITECTURE.md) §3.1 (the `app/routes` segment; web↔mobile parity); this doc is the detailed
> rulebook the foundation (plan/15) installed. Mobile's peer is `react-navigation` in `apps/mobile/src/app/navigation`
> — the same discipline, a different library.

## 1. Library and confinement

`apps/web` routes with **TanStack Router v1** (`@tanstack/react-router`). The library is imported **only** inside
`apps/web/src/app/routes/` — the sole routing segment. `pnpm lint:fsd:layout` enforces that `app` stays segmented, and
a grep for `@tanstack/react-router` outside `app/routes/` must return nothing. Lower FSD layers (`pages`, `features`)
never import the library; they navigate through the seam in §4.

| File                           | Role                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `routes/route-tree.tsx`        | the code-based route tree + `RouterContext` type                                          |
| `routes/router.ts`             | `createAppRouter(...)` factory + the `declare module … Register` type registration        |
| `routes/WebRouterProvider.tsx` | reads the diagnostics flag + auth facade, memoizes the router, renders `<RouterProvider>` |
| `routes/route-screens.tsx`     | the statically-imported route components (the public surface, §5d)                        |
| `routes/screens/*.tsx`         | one module per dynamically-imported screen (§5d)                                          |
| `routes/me-search.ts`          | `/me`'s `?tab=` vocabulary + validate-or-drop                                             |
| `routes/guards/auth-gate.ts`   | the auth guard (`authGuardBeforeLoad`) + the `from` return-target validation              |
| `routes/not-found.tsx`         | the localized not-found screen                                                            |
| `routes/navigation.ts`         | the typed navigation seam (`Link`, `useAppNavigate`)                                      |
| `routes/index.ts`              | the segment's public API                                                                  |

## 2. The route tree

- **Code-based**, not file-based: `createRootRouteWithContext<RouterContext>()` for the root (component renders
  `<Outlet/>`, `notFoundComponent` is the localized screen), `createRoute` per screen, composed with `addChildren`.
  File-based routing is not used — it scatters route files and fights FSD.
- Current routes: a pathless **`authenticated`** layout route (the auth gate, §8) parenting `/universe` →
  `UniverseHomePage` (`pages/universe`), `/diary` → `DiaryReaderPage` (`pages/diary-reader`, plan 47), and `/me` →
  `MePage` (`pages/me`, plan 64); outside it, **`/` → `LandingPage`** (`pages/landing`, the public front door, §5b),
  `/login` and `/signup` → the two `LoginPage` modes,
  `/invite/$token` → invite capture then replacement with `/signup`, `/test` → `TestPage`, and
  `/design` → `DesignShowcasePage` (`pages/design`, the design showcase), `/demo` → `DemoPage`
  (`pages/demo`, the public trailer, §5a), and the splat `/blog/$` → `BlogNotFoundPage` (`pages/blog-not-found`, §5c). Because `pages` may not import the router (§4), a route's `component` is a thin **app-layer
  wrapper** that reads `useAppNavigate` and injects `onOpenReader`/`onExit`-style callbacks into the page — the
  navigation seam stays inside `app/routes/`.
- **Adding a route** (done by a presentation plan): add a `createRoute` in `route-tree.tsx`, point it at a `pages/`
  screen, and register it in `addChildren` — **under the `authenticated` layout route** for any product surface (it
  inherits the auth gate, §8). A **public** surface goes under `rootRoute` with no `beforeLoad` and, if it is a page a
  stranger lands on, inside the public-page import closure (§5a/§5b). Nothing outside `app/routes/` changes.

### 5c. The `/blog/**` miss (plan 82)

`/blog/**` is **not** this router's — the Worker's asset handler serves the Astro-built blog staged into
`apps/web/dist/blog`. The splat route `/blog/$` under `rootRoute` (no `beforeLoad`, no session, no diagnostics flag) only
executes on a genuine miss, because static assets resolve first. It renders blog-shaped chrome so a stale essay link is not
answered in the app's voice, and it goes back to `/blog/` through `window.location` rather than a navigation — a client
navigation would land straight back on itself. `not_found_handling: "single-page-application"` returns HTTP 200, so it is
a soft 404 mitigated by `noindex`; see [blog-site.md](blog-site.md) §5.

### 5b. The public root (plan 81)

`/` is `landingRoute` under `rootRoute` with **no `beforeLoad`**: an auth guard there would redirect away the one
visitor the route exists for. `LandingRoute` resolves by gate decision instead — `'landing'` renders the page,
`'universe'` navigates to `/universe`, `'login'` navigates to `/login`, `'hold'` renders the shipped neutral hold — so
`/` is the app's single decision point and no URL means two things at once. It also carries the public locale switch:
`pages` may not import `app`, so `setActiveLocale` + `writeStoredLocale` reach the page as an injected callback, the
same seam `onOpenReader`/`onExit` use. The landing's import closure bans `@connectrpc/*`, the generated clients, the
query/cache seam, every server-backed `/react` mirror and `@cosimosi/demo`: the front door cannot obtain a transport,
so no product read is expressible there. `apps/web/public/{robots.txt,sitemap.xml}` and the shell's SEO block belong to
this route — see [landing-page.md](landing-page.md).

## 3. Type safety

`createAppRouter` registers its type once:

```ts
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
```

Every `Link to=…` / `navigate({ to })` is then compile-time path-checked — an unknown path fails `pnpm typecheck`.
This is the web counterpart of the mobile shell's `RootStackParamList`.

### 3.1 Search params — `/diary`'s conditions ([D7][D8])

`/diary` is the one route whose search params carry product state: `q` (keyword), `moods`, `from`, `to`
and `sort`. `validateSearch` runs `parseDiarySearch`, which **validates or drops** every field rather
than forwarding it: an unknown mood, a date that is not a full ISO day, an unknown sort, and a keyword
below `diary_reader.search_min_query_length` all fall back to the default view. The URL is
user-editable, so a hand-shortened link must land on the archive rather than on a refusal the reader
cannot act on.

Three seams keep the rest of the app router-free:

- `app/routes/diary-search.ts` is the only place the URL's short keys and the generated
  `GetDiariesRequest` shape meet. Nothing below the app layer holds a hand-written mirror of the
  conditions.
- `screens/diary-reader-route.tsx` injects the parsed conditions plus a setter as props (the job-58
  callback seam), so `pages/*` and `widgets/*` import no router.
- The setter takes an **update function** and hands it to `navigate({ search: (previous) => … })`, so a
  merge always happens against the live search. A plain object patch would let two controls touched
  inside one navigation round trip overwrite each other's pick — the debounced keyword and a mood chip
  are exactly that pair. Writes use `replace: true`, so a typed phrase does not bury the universe under
  a history entry per keystroke.

### 3.2 Search params — `/diary`'s view state ([D12])

Two further `/diary` keys carry **view** state rather than conditions: `view` (only `calendar` is kept —
`list` is the absent default, so a bare `/diary` stays bare) and `month` (`YYYY-MM`, validated by regex).
They ride the same validate-or-drop discipline, and three rules keep them from behaving like conditions:

- They are **absent from `diaryQueryFromSearch` / `diarySearchFromQuery`**. Those two map the
  `GetDiariesRequest` conditions, and routing a view key through them would make a view switch look like a
  conditions change — which resets the keyset page and closes the opened row.
- `searchWithUpdate` therefore **carries `view`/`month` across untouched**. Without that, a keystroke in the
  search field would drop the reader out of the calendar mid-typing, because the conditions round trip does
  not reproduce them.
- **`view` writes `replace`, `month` writes push.** Mounting the calendar is a way of looking, not a place,
  so it adds no history entry; stepping a month is a move worth undoing, so Back returns the previous month.

The day click-through is two navigations in one handler — the date range, then the view — and it relies on
the update-function merge above: the second updater sees the first's search, so the chosen day's
`from`/`to` survives the switch back to the list. `diary-view-navigation.test.ts` pins that composition and
the replace/push history semantics, because both are router behavior rather than app logic.

The initial month is **resolved, not stored**: with no `month` key the calendar opens on the month of the
newest diary already in the archive cache, else the device-local current month. The resolved value is never
written back, which is what keeps mounting free of a history entry.

## 4. Navigation seam

`pages` / `features` navigate through `routes/navigation.ts`, which re-exports `Link` and `useAppNavigate`
(`= useNavigate`). Consumers import these from `app/routes`, never from `@tanstack/react-router`, so the library stays
confined to the segment.

## 5. The dev-only gates — `/test` and `/design`

`/test` is the plan/12 platform harness; `/design` is the design showcase the design review reads
(both dev-only, both outside the authenticated subtree since neither reads product data). Each
`beforeLoad` throws `notFound()` unless `context.diagnosticsEnabled` is true. `WebRouterProvider` resolves that flag as
`import.meta.env.DEV || getFeatureFlag('platform.diagnosticsSurface')`: **always reachable under the Vite dev server**,
and in a **production build only when the diagnostics flag is explicitly on** (otherwise `/test` resolves to the
not-found screen). The flag key lives in `shared/config/diagnosticsSurfaceFlag` and is read from the observability
facade — the same key and facade the mobile shell uses to gate its `Diagnostics` screen.

## 5a. The public `/demo` route and the demo isolation closure

`/demo` sits under `rootRoute` beside `/login`, **outside** the authenticated subtree, with **no
`beforeLoad` of any kind** — not the auth guard (a signed-out visitor is its entire audience) and not
the diagnostics gate that covers `/test` and `/design`. Sitting outside the authenticated layout is
also what keeps `PaletteBootstrap`, `ProfileGate`, `DecorationBootstrap` and the achievement notice
host off it. Deployment needs no change: the Worker's SPA not-found handling already serves any deep
link ([DEPLOY.md](../../DEPLOY.md) §1). `DemoRoute` supplies the one thing the page needs from the
router — where the closing CTA goes — so the page imports no router, the same seam as
`UniverseRoute`/`LoginRoute`.

The demo is formally exempt from the invariants, and an exempt sandbox is safe only while it is
unreachable from the real code path. That is enforced by a **demo-scoped `no-restricted-imports`
block** on `src/pages/demo/**` in `apps/web/eslint.config.js`, which should be read as a **closure,
not an allowlist**:

| Banned from `pages/demo`                                                                                                                   | What it closes                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `@connectrpc/*`                                                                                                                            | the only source of `useTransport()`                                            |
| `@cosimosi/api-client`, `@cosimosi/client-cache`                                                                                           | the generated clients and the query/cache seam                                 |
| `@cosimosi/{universe,twinkle,memory,store,achievement}/react`                                                                              | the server-backed read mirrors                                                 |
| `@cosimosi/emotion/react`'s `writeMoodColor` · `readMoodColors` · `readMoodColorRecommendations` · `useMoodColorEditor` (by `importNames`) | the colour writes that reach `AccountService`                                  |
| `@cosimosi/twinkle`, `@cosimosi/twinkle-logic`, `@cosimosi/store`                                                                          | prices, balances, ownership and `Decorate`                                     |
| `widgets/*`, `features/*`, `entities/*` — except `widgets/sequence-guide` and `features/highlight-next-control`                            | narrows the normally-legal `pages → widgets` edge (the `pages/test` precedent) |

**Why it needs no maintained symbol allowlist.** Every RPC-issuing function in `packages/*` takes an
`ApiTransport` as its first argument, and every hook that hides one calls `useTransport()`. A page
starved of both cannot issue a server call by accident, whatever barrel export drifts into scope
later. The two chrome carve-outs are safe for the same reason from the other side:
`@cosimosi/sequence` depends on `xstate` + `zustand` only, so it is provably server-free.

**Two mechanical traps.** ESLint flat config **replaces** rule options per matching file rather than
merging them, so the demo block must **restate** the `three` / `@react-three/fiber` and `@cosimosi/i18n`
bans — otherwise they would be silently lost for exactly the files that mount the renderer. And the
positive half of the boundary — **no `isDemo` flag, prop, parameter or branch in `packages/*`,
`features/*` or `entities/*`** — is a standing ban discharged by adding none; `lint:fsd:layout` R4
catches a copy-pasted mirror, and the demo fixtures have no field a demo-only value could be written
into.

`scripts/probe-demo-isolation.mjs` (wired into `pnpm test:guards`) proves the block bites: it writes
throwaway files under `pages/demo`, runs ESLint on them, and asserts each forbidden import is reported
and each permitted one is not. A lint rule nobody has seen fail is a rule nobody knows is wired.

**The run FSM lives inside the closure.** Change 10 added a demo-local XState machine
(`pages/demo/model/run-machine.ts`) that owns the run's phase — tutorial step ↔ free play — and is
the single derivation every control's interactivity comes from. It is a `pages/demo` module beside
plan 78's sequence engine (which keeps the tour's caption/highlight/skip chrome), imported from
`xstate` directly like any other page-local machine; the import-ban block is **unchanged** and the
machine adds no new seam — no shared package learned that a demo, a tutorial or a gate exists.

**The precise reading of "frontend-only":** no `apps/api` RPC, no DB write, no LLM port. Platform
telemetry and the app-shell auth bootstrap run above every route, including this one, and are out of
scope. **Never mounted on `/demo`:** `UniverseCanvasWidget` (its `useUniverse()` throws
unauthenticated), `StardustOverlay`, `UniverseTimeOverlay`, `WritingFlowSheet` (its split is an LLM
call), `RecallFlowSheet`, `DeletionFlowSheet`, and `DetailPanel`'s provenance / gist reads.

**Mobile parity is waived in writing.** The demo is a Visitor surface reached from the landing page,
and the Visitor gets web-funnel behaviours only — the same waiver the admin console carries
(`spec/policy/ops/admin.md` §6). It is stated because `scripts/lint-fsd-layout.mjs` does not enforce
web↔mobile page peering, so an unstated waiver is a silently broken rule. `steiger` needs **no**
exemption: every shipped `insignificant-slice` block targets `entities|features|widgets`, and a page
slice is not "insignificant" (verified — `lint:fsd` is green with none added).

## 5d. The bundle split — which routes ship in the entry chunk

The origin root is the landing page, so whatever rides in the entry chunk is what every cold visitor and
every crawler downloads before the hero paints. The route seam is therefore also the **chunk boundary**:

| Loaded                             | Routes                                                                                     | Why                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **static** (entry chunk)           | `/`, `/login`, `/signup`, `/invite/$token`, `/blog/$`, the pathless `authenticated` layout | the public surface a stranger lands on cold, plus the guard. Lazy-loading the page the visitor asked for would add a round trip to the path the split exists to speed up, and moving the layout behind a dynamic import would let an unauthenticated frame render before `beforeLoad` |
| **dynamic** (`lazyRouteComponent`) | `/universe`, `/diary`, `/me`, `/admin`, `/demo`, `/test`, `/design`                        | nobody arrives on these cold: the product needs a session, `/demo` is reached from a landing CTA, and the two diagnostics surfaces are unreachable unless the flag is on                                                                                                              |

Rules that keep it working:

- **`lazyRouteComponent`, never bare `React.lazy`.** The route tree is hand-built; `lazyRouteComponent` is
  the API wired into the router's pending and `.preload()` lifecycle. `router.load()` awaits the chunk,
  which is why the SSR tests still assert synchronously against a lazily-imported screen.
- **One module per lazy screen, in `app/routes/screens/`.** Chunks are cut per module, so a screen sharing a
  file with a static one lands back in the entry chunk. `route-screens.tsx` holds the static half.
- **A static value import from a page's barrel drags the screen in with it.** `/me`'s `validateSearch`
  needs the `?tab=` vocabulary in the entry chunk, so `app/routes/me-search.ts` owns it (§3.1's seam,
  as for `/diary`) and takes `MeTabId` as a **type-only** import — erased, so no runtime edge. A value
  import from `pages/me` would have pulled `MePage` and its nine features into the entry chunk.
- **`defaultPendingComponent` is set once** in `createAppRouter`, to the same `AuthHold` a settling session
  shows. It is not only cosmetic: TanStack wraps a match in `Suspense` **only** when a pending component
  exists, so without it a lazily-imported screen suspends to the root's `null` fallback — a blank frame.
- **`build.chunkSizeWarningLimit`** in `apps/web/vite.config.ts` is calibrated just above the largest chunk
  shipped on purpose (the renderer chunk). Measure before raising it.
- `route-splitting.test.ts` pins the table above, so converting a screen back to a static import — or
  quietly making a public page lazy — fails a test rather than silently costing every cold visitor.

**Still open:** the entry chunk is renderer-dominated. `three.js` reaches it as a static dependency of the
landing's own two scenes, so the next win is a **reduced renderer entry** for `LandingHeroScene` /
`LandingWalkthroughScene` — a separate change with its own measurement. Preloading a lazy route on link
intent (`defaultPreload`) is the other unclaimed follow-up.

## 6. Composition and testing

- `WebRouterProvider` mounts `<RouterProvider>` as the routed child of the provider stack (observability → error
  boundary → i18n → auth → cache/session-scope boundary → router), so every route sees all providers. The
  authenticated subtree first passes the profile gate, which withholds both palette and product
  reads until `GetProfile` returns a profile, then adds the palette commit gate around its outlet.
  Login and diagnostics wait for neither gate. It resolves `diagnosticsEnabled`
  from the observability facade and memoizes the router on `[router, initialEntries, diagnosticsEnabled]`.
- **Tests / storybook** render at a chosen route without a DOM: build a router with
  `createAppRouter({ diagnosticsEnabled, initialEntries })` (in-memory history), `await router.load()`, then inject it
  via `<App router={…}>`. Production omits both props and the router uses browser history.

## 7. Match semantics

- **Query strings are ignored for route matching** (`/test?probe=1` resolves to `/test`) — this preserves the behavior
  of the retired hand-rolled path normalizer and covers real cases (OAuth/tracking params on a URL).
- **`/me` owns one validated query value**: `tab` accepts `profile`, `stardust`, `achievements`, `diary`, or
  `account`. `validateSearch` drops an unknown value; `MeRoute` resolves a missing value to `profile`. Tab changes
  replace the current history entry, remain deep-linkable, and survive reload without introducing a tab state
  machine.
- **Trailing slash is pinned to `'never'`** on `createAppRouter`, so the canonical client form is slashless
  (`/universe`, `/demo`) with the root as the sole exception. It is pinned rather than defaulted because the origin now
  publishes canonical URLs: the shell's `<link rel="canonical">` and `public/sitemap.xml` use that same form, and the
  router has to agree with them. `/blog/` is **outside** this router — the Worker's asset handler serves it — so the
  blog's own `trailingSlash: 'always'` cannot conflict, and no product route's matching behaviour changed. Owned by
  plan 81, which introduced the first real information architecture.

## 8. The auth gate (plan 53) — the app-entry contract

**`/` is the public front door; the universe is `/universe`.** The rule is one pure mapping —
`gateDecision(status)` in `packages/auth` (beside the [04] facade): `authenticated` → universe; settled **`signedOut` →
landing**; `signingIn`/`expired`/`failed` → login (a returning user whose token died is not a marketing arrival, and
`failed` is a signed-out user from the product's view, never an error screen); `bootstrapping`/`refreshing` → **hold**
(neutral, never a redirect — no signed-out flash and no landing flash either; [04] preserves `userId` through a
refresh).

Widening that union was the dangerous part, because every consumer used to ask `=== 'login'` and a fourth arm would
have passed all of those comparisons silently. So the same file exports **`requiresSignIn(decision)`** — an exhaustive
`switch`, true for `'login'` and `'landing'` — and all four consumers (the web guard, the authenticated layout, the
landing wrapper's sibling checks, the mobile stack selector) branch through it. A future fifth decision is a compile
error inside one pure function instead of a behaviour change spread across four files. Both apps express the mapping
through their own nav seam (disciplinary parity, §3.5):

- **Web** — every product route mounts under a pathless **`authenticated` layout route**. Its `beforeLoad` runs
  `authGuardBeforeLoad` (`routes/guards/auth-gate.ts`): a settled signed-out arrival is `redirect`ed to `/login`
  carrying the requested **pathname** as `from` (pathname only — an auth round trip returns `/me` to its default
  profile tab rather than replaying arbitrary search). The
  layout component then renders from the **live** snapshot: initial `bootstrapping` → a neutral hold; `authenticated`
  / `refreshing` → `<Outlet/>` (the universe stays mounted through a token refresh); a session that settles signed-out
  **while mounted** navigates to `/login` with the current pathname. Product reads (`GetUniverse`) mount only under
  the layout, so none can issue without a session. The router context carries a live `getSessionStatus` accessor
  (wired from the [04] facade in `WebRouterProvider`) — the guard never touches Supabase or the session machine.
- **`/login` and `/signup`** — public routes composing the auth facade's sign-in and signup
  commands. Both hold while the session settles, bounce authenticated users to the product, and
  navigate reciprocally. `/` reaches `/login` too, from the landing header's sign-in link
  (`LandingRoute` supplies `onSignIn` beside the demo and signup destinations); the two screens
  share the landing's own ground, recorded in [landing-page.md](landing-page.md) §2b. `/invite/$token` captures into the pending-invite holder and replaces its
  history entry with `/signup`, so the opaque token leaves the address bar and back history.
  On reaching `authenticated`, `/login` navigates to
  `loginReturnTarget(from)` — `from` is user-visible URL input, validated at use: only an internal single-slash
  pathname is replayed (never `//host`/absolute URLs and never `/`, `/login`, `/signup`, or
  `/invite/...` — `/` joins that set because replaying it would bounce a freshly signed-in user back through the
  marketing gate), else `/universe`. While
  `bootstrapping`/`refreshing` the route renders the neutral hold, not the form (the no-flash rule applies to `/login`
  too); `signingIn` stays on the form.
- **Mobile mirror** — `app/navigation/NavigationRoot.tsx` selects the authoritative stack from the same snapshot via
  the same mapping: login decision → the `Login` stack; `bootstrapping` → the `Boot` splash; otherwise the
  `Universe` stack (`refreshing` keeps it mounted — a cold entry is never `refreshing`). React Navigation swaps the
  mounted stack on decision change, so sign-in/sign-out routing needs no manual resets. Product composition lives in
  `pages/{login,universe,diary-reader,me}`; module-private route adapters pass callback/data props, while the
  neutral `BootScreen` alone remains under `app/navigation/screens`. `Me` carries no route parameter, keeps its tab
  locally, and is reachable through the `'me'` deep link. The shell-era `ShellHome` screen is retired.
- **Sign-out** routes to login on both apps by the same observation; nothing persisted is deleted. Before the new
  auth-scope subtree commits, the scope boundary clears the full Query cache (including injected clients) plus every
  registered user mirror, draft, target, deferred action, release/balance mirror, and palette epoch. A re-sign-in then
  reads that user's universe afresh ([I1]); the inventory contract is [tech/auth.md](auth.md).

## 9. Not built here

No SSR / framework mode (pure client SPA), no prerendering of the public root (plan 81 records that limitation and its
trigger for revisiting), no route-level code-splitting or lazy routes, and no route loaders / Query prefetching. Product
feature routes remain one-per-presentation-plan, registered under the `authenticated` layout (§8).
