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

| File                           | Role                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `routes/route-tree.tsx`        | the code-based route tree + `RouterContext` type                                   |
| `routes/router.ts`             | `createAppRouter(...)` factory + the `declare module … Register` type registration |
| `routes/WebRouterProvider.tsx` | reads the diagnostics flag, memoizes the router, renders `<RouterProvider>`        |
| `routes/not-found.tsx`         | the localized not-found screen                                                     |
| `routes/navigation.ts`         | the typed navigation seam (`Link`, `useAppNavigate`)                               |
| `routes/index.ts`              | the segment's public API                                                           |

## 2. The route tree

- **Code-based**, not file-based: `createRootRouteWithContext<RouterContext>()` for the root (component renders
  `<Outlet/>`, `notFoundComponent` is the localized screen), `createRoute` per screen, composed with `addChildren`.
  File-based routing is not used — it scatters route files and fights FSD.
- Current routes: `/` → `UniverseHomePage` (`pages/universe`), `/test` → `TestPage` (`pages/test`).
- **Adding a route** (done by a presentation plan): add a `createRoute` in `route-tree.tsx`, point it at a `pages/`
  screen, and register it in `addChildren`. Nothing outside `app/routes/` changes.

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

- `WebRouterProvider` mounts `<RouterProvider>` as the **innermost** child of the provider stack (observability →
  error boundary → i18n → auth → cache → router), so every route sees all providers. It resolves `diagnosticsEnabled`
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

## 8. Not built here

No SSR / framework mode (pure client SPA), no route-level code-splitting or lazy routes, no route loaders / Query
prefetching, no product feature routes (each is its own presentation plan), and no auth-gated redirects
(`auth-universe-gate`, Epic I, owns that).
