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
| `routes/guards/auth-gate.ts`   | the auth guard (`authGuardBeforeLoad`) + the `from` return-target validation              |
| `routes/not-found.tsx`         | the localized not-found screen                                                            |
| `routes/navigation.ts`         | the typed navigation seam (`Link`, `useAppNavigate`)                                      |
| `routes/index.ts`              | the segment's public API                                                                  |

## 2. The route tree

- **Code-based**, not file-based: `createRootRouteWithContext<RouterContext>()` for the root (component renders
  `<Outlet/>`, `notFoundComponent` is the localized screen), `createRoute` per screen, composed with `addChildren`.
  File-based routing is not used — it scatters route files and fights FSD.
- Current routes: a pathless **`authenticated`** layout route (the auth gate, §8) parenting `/` → `UniverseHomePage`
  (`pages/universe`), `/diary` → `DiaryReaderPage` (`pages/diary-reader`, plan 47), and `/settings` → `SettingsPage`
  (`pages/settings`, plan 52); outside it, `/login` → `LoginPage` (`pages/login`, plan 53) and `/test` → `TestPage`
  (`pages/test`). Because `pages` may not import the router (§4), a route's `component` is a thin **app-layer
  wrapper** that reads `useAppNavigate` and injects `onOpenReader`/`onExit`-style callbacks into the page — the
  navigation seam stays inside `app/routes/`.
- **Adding a route** (done by a presentation plan): add a `createRoute` in `route-tree.tsx`, point it at a `pages/`
  screen, and register it in `addChildren` — **under the `authenticated` layout route** for any product surface (it
  inherits the auth gate, §8). Nothing outside `app/routes/` changes.

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

## 4. Navigation seam

`pages` / `features` navigate through `routes/navigation.ts`, which re-exports `Link` and `useAppNavigate`
(`= useNavigate`). Consumers import these from `app/routes`, never from `@tanstack/react-router`, so the library stays
confined to the segment.

## 5. The `/test` gate

`/test` is a dev-only surface (the plan/12 harness). Its `beforeLoad` throws `notFound()` unless
`context.diagnosticsEnabled` is true. `WebRouterProvider` resolves that flag as
`import.meta.env.DEV || getFeatureFlag('platform.diagnosticsSurface')`: **always reachable under the Vite dev server**,
and in a **production build only when the diagnostics flag is explicitly on** (otherwise `/test` resolves to the
not-found screen). The flag key lives in `shared/config/diagnosticsSurfaceFlag` and is read from the observability
facade — the same key and facade the mobile shell uses to gate its `Diagnostics` screen.

## 6. Composition and testing

- `WebRouterProvider` mounts `<RouterProvider>` as the routed child of the provider stack (observability → error
  boundary → i18n → auth → cache/session-scope boundary → router), so every route sees all providers. Authenticated
  product routes add the palette commit gate immediately around their outlet; login and diagnostics do not wait for a
  user preference. It resolves `diagnosticsEnabled`
  from the observability facade and memoizes the router on `[router, initialEntries, diagnosticsEnabled]`.
- **Tests / storybook** render at a chosen route without a DOM: build a router with
  `createAppRouter({ diagnosticsEnabled, initialEntries })` (in-memory history), `await router.load()`, then inject it
  via `<App router={…}>`. Production omits both props and the router uses browser history.

## 7. Match semantics

- **Query strings are ignored for route matching** (`/test?probe=1` resolves to `/test`) — this preserves the behavior
  of the retired hand-rolled path normalizer and covers real cases (OAuth/tracking params on a URL).
- **Trailing slashes are not normalized** (`/test/` does not match `/test`). This is unhandled by design for the
  current two-route set; a presentation plan that introduces a real information architecture owns the trailing-slash
  policy for its routes.

## 8. The auth gate (plan 53) — the app-entry contract

**No landing page in v1: the unauthenticated default is `/login`, the authenticated default is the universe (`/`),
with no intermediate route.** The rule is one pure mapping — `gateDecision(status)` in `packages/auth` (beside the
[04] facade): `authenticated` → universe; settled `signedOut`/`signingIn`/`expired`/`failed` → login (`failed` is a
signed-out user from the product's view, never an error screen); `bootstrapping`/`refreshing` → **hold** (neutral,
never a redirect — no signed-out flash; [04] preserves `userId` through a refresh). That mapping is the single
insertion seam a v2 landing route would slot into. Both apps express it through their own nav seam (disciplinary
parity, §3.5):

- **Web** — every product route mounts under a pathless **`authenticated` layout route**. Its `beforeLoad` runs
  `authGuardBeforeLoad` (`routes/guards/auth-gate.ts`): a settled signed-out arrival is `redirect`ed to `/login`
  carrying the requested **pathname** as `from` (pathname only — v1 product routes hold no state in the query). The
  layout component then renders from the **live** snapshot: initial `bootstrapping` → a neutral hold; `authenticated`
  / `refreshing` → `<Outlet/>` (the universe stays mounted through a token refresh); a session that settles signed-out
  **while mounted** navigates to `/login` with the current pathname. Product reads (`GetUniverse`) mount only under
  the layout, so none can issue without a session. The router context carries a live `getSessionStatus` accessor
  (wired from the [04] facade in `WebRouterProvider`) — the guard never touches Supabase or the session machine.
- **`/login`** — a public route composing the [04] facade's `signIn`. On reaching `authenticated` it navigates to
  `loginReturnTarget(from)` — `from` is user-visible URL input, validated at use: only an internal single-slash
  pathname is replayed (never `//host`/absolute URLs, never `/login` itself), else `/`. While
  `bootstrapping`/`refreshing` the route renders the neutral hold, not the form (the no-flash rule applies to `/login`
  too); `signingIn` stays on the form.
- **Mobile mirror** — `app/navigation/NavigationRoot.tsx` selects the authoritative stack from the same snapshot via
  the same mapping: login decision → the `Login` stack; `bootstrapping` → the `Boot` splash; otherwise the
  `Universe` stack (`refreshing` keeps it mounted — a cold entry is never `refreshing`). React Navigation swaps the
  mounted stack on decision change, so sign-in/sign-out routing needs no manual resets. Product composition lives in
  `pages/{login,universe,diary-reader,settings}`; module-private route adapters pass callback/data props, while the
  neutral `BootScreen` alone remains under `app/navigation/screens`. The shell-era `ShellHome` screen is retired.
- **Sign-out** routes to login on both apps by the same observation; nothing persisted is deleted. Before the new
  auth-scope subtree commits, the scope boundary clears the full Query cache (including injected clients) plus every
  registered user mirror, draft, target, deferred action, release/balance mirror, and palette epoch. A re-sign-in then
  reads that user's universe afresh ([I1]); the inventory contract is [tech/auth.md](auth.md).

## 9. Not built here

No SSR / framework mode (pure client SPA), no route-level code-splitting or lazy routes, no route loaders / Query
prefetching, and no landing/marketing route (v2 — `gateDecision` is its reserved insertion seam). Product feature
routes remain one-per-presentation-plan, registered under the `authenticated` layout (§8).
