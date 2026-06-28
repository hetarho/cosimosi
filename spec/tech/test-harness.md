# tech: test harness

> As-built rules for the temporary web `/test` route. The route exists to verify Phase 1 seams and later headless
> domain/use-case units before product presentation exists. It is not product navigation and not final UI.

## 1. Route and provider boundary

`apps/web/src/app/App.tsx` selects `/test` through a thin route switch and renders it inside the same app provider stack
as the rest of the web app:

- observability error boundary and provider;
- i18n provider;
- auth provider;
- QueryClient and Connect transport provider;
- design-system CSS and primitives through the app entry CSS and `@cosimosi/ui`.

The route is intentionally not linked from product navigation. There is no product nav item in Phase 1; future product
navigation must continue to omit `/test`.

## 2. Panel registry

The route shell renders a typed registry rather than importing panel internals directly. A panel definition has:

- `id`;
- `titleKey`;
- optional `descriptionKey`;
- `requiredCapabilities`;
- `render`.

`titleKey` and `descriptionKey` are Paraglide message keys. The shell owns selection, availability, common status
formatting, and unavailable states. Panels own only their small diagnostic body.

Future units add browser diagnostics by exporting a panel definition and adding it to the composed registry; they do
not rewrite the route shell.

## 3. Capabilities and graceful degradation

Panels declare the seams they need through `requiredCapabilities`. The shell compares those requirements with the
capabilities available in the current harness and renders a standard unavailable state when a dependency is absent.
That lets Phase 2-3 plans register optional browser checks before all backing services exist.

Current Phase 1 capabilities are:

- transport;
- auth;
- QueryClient;
- generated values;
- i18n;
- design system.

State-machine, domain-fixture, and golden-parity capabilities are reserved for later headless plans.

## 4. Fake helper rule

Tests and offline diagnostics use the shared fake helpers, not production secrets:

- `@cosimosi/auth` `FakeAuthAdapter`;
- `@cosimosi/api-client` `createPlatformMockTransport`;
- `@cosimosi/client-cache` `createClientCacheTestContext`.

`apps/web/src/shared/test-panel/fakes.ts` composes those imports into `createTestHarnessFakes()` for route and panel
smoke tests.

## 5. Headless unit convention

Every later headless domain/use-case unit should ship verification in this order:

1. Automated tests in the unit's owning package/app. Pure cross-platform math should prefer golden-parity tests where
   both frontend and backend own the same behavior.
2. Optional `/test` panel for browser inspection when a human needs to inspect RPC calls, cache state, fixtures,
   derived objects, or golden-parity results.
3. No product navigation, final presentation slice, universe renderer, marketing page, or domain behavior inside the
   harness route itself.

Panels may call existing RPCs, run pure fixtures, inspect Query cache, and show structured JSON/table results. They
must not become product screens or encode product navigation.

## 6. Copy and UI

Panel copy goes through `packages/i18n/messages/{en,ko}.json` and generated `m.*` functions. Panel UI uses
`@cosimosi/ui` primitives when a primitive exists. Local HTML/CSS is allowed only for route layout and simple diagnostic
formatting around those primitives.
