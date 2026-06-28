# tech: observability and flags

> As-built rules for cosimosi's privacy-aware telemetry and feature-flag seam. The
> architectural frame lives in [ARCHITECTURE.md](../ARCHITECTURE.md) §2.7
> (Connect request boundaries), §3.1/§3.5 (web/mobile app roots + shared packages),
> and §4 (per-user isolation). This doc is the detailed rulebook installed by
> [plan/10](../plan/10.observability-and-flags.md).

## 1. Package and app boundaries

| Concern | Location |
|---|---|
| Cross-app facade, consent gate, safe property typing, in-memory adapter | `packages/observability/src/*` |
| React context and app-level error boundary | `packages/observability/src/react.tsx` |
| Connect request-id client interceptor | `packages/observability/src/connect.ts` |
| Web vendor adapter | `apps/web/src/app/observability-provider.tsx` |
| Mobile vendor adapter | `apps/mobile/src/app/observability-provider.tsx` |
| API reporter and safe attributes | `apps/api/internal/platform/observability/*` |
| API error/panic/reporting interceptors | `apps/api/internal/platform/{handler,interceptors}.go` |
| Direct-vendor-import guard | `scripts/check-observability-boundaries.mjs` (`pnpm lint:observability`) |

Feature/domain slices import `@cosimosi/observability` or the app context only. Direct
Sentry/PostHog imports are allowed only at app/platform observability boundaries:
`apps/web/src/app/observability-provider.tsx`,
`apps/mobile/src/app/observability-provider.tsx`, and
`apps/api/internal/platform/observability/sentry.go`. The boundary guard scans the
clean app roots and `packages/`/`apps/api/internal`; `apps/*-mvp` are reference-only
and are not part of the clean Phase 1 workspace. The guard matches quoted import
specifiers by prefix, so subpath imports and dynamic imports are rejected too.

## 2. Consent and telemetry classes

Telemetry has two classes:

- **Operational error telemetry:** `captureException` and `captureMessage`. It may run
  before analytics consent because exception reports are reduced to stable error
  names/messages plus safe properties and do not carry diary text, tokens,
  embeddings, generated memory content, request payload bodies, or original
  exception messages.
- **Analytics/user identification:** `track` and `identify`. These calls are blocked
  until `setConsent("granted")`. `setConsent("denied")` stops future analytics and
  resets adapter identity where the vendor supports it.

The default consent state is denied. Web/mobile Sentry adapters disable default
auto-capture integrations and receive only facade-redacted exceptions. Web PostHog
initialization opts out by default, disables autocapture, disables pageview capture,
and disables session recording. Mobile exposes the same consent-aware adapter seam;
a PostHog-compatible native client can be injected by the mobile shell when that
dependency is owned there.

React providers keep the facade instance stable across StrictMode effect replays. The
web/mobile vendor SDK adapters are attached from effects through a delegated adapter
instead of initialized during render; the delegated adapter receives the current
consent state as soon as it is attached. Error boundaries expose a reset render prop
and reset-key path so app shells can render platform-specific recovery UI.

## 3. Safe properties

`SafeTelemetryProperties<T>` rejects sensitive keys at type-check time for literals,
and `assertSafeTelemetryProperties` rejects the same keys at runtime for dynamic bags.
The blocked key families include diary text, record body, generated memory content,
raw embeddings, auth tokens, secrets, and passwords.

API telemetry uses `observability.Attributes`, which can only be built through
`NewAttributes`/`MustAttributes`. It carries stable operational fields such as
`source`, `method`, `request_id`, and `rpc_code`; handlers never attach payload bodies
or private content.

## 4. Request IDs and error reporting

The API request-id middleware/interceptor remains the source for `X-Request-Id`.
Client-provided ids are accepted only when they are short ASCII tokens
(`A-Z`, `a-z`, `0-9`, `.`, `_`, `-`, `:`); unsafe values are replaced with a
server-generated id before they can reach logs or telemetry. Responses and Connect
metadata expose the safe id as before. The frontend Connect interceptor stores only
safe response/error request ids in the observability facade; app error boundaries
include that id in later error reports.

API unexpected failures are handled in two places:

- `StructuredErrorInterceptor` reports `CodeInternal`/`CodeUnknown` errors, then maps
  the client-facing error to stable `CodeInternal: internal server error`. Reports
  include a safe `error_type` discriminator instead of raw error messages.
- `PanicRecoveryInterceptor` recovers panics, reports a safe panic event, and returns
  the same stable internal error. Reports include a safe `panic_type` discriminator
  instead of the recovered panic value.

Known application/auth errors keep their existing canonical Connect codes and are not
reported as unexpected failures.

## 5. Feature flags

Flags live in `platformFeatureFlags`, a typed registry with committed defaults, owner
references, descriptions, review notes, and optional remote keys. The initial shipped
flag is `platform.diagnosticsSurface` (default `false`), an operational development
surface flag. It is not a product experiment.

Rules:

- feature code reads through the observability facade (`getFeatureFlag`);
- local/test/dev overrides are registry-level overrides, not scattered conditionals;
- remote PostHog values are consulted only after analytics consent is granted;
- remote values fall back to committed defaults when absent or disabled;
- flags are boolean-only in this platform seam. Numeric product tuning belongs in
  `spec/values.yaml` and generated config, never in the feature-flag registry.

## 6. Dependencies and runtime config

Current SDKs installed from official docs/current registries:

- web: `@sentry/react`, `posthog-js`;
- mobile: `@sentry/react-native`;
- API: `github.com/getsentry/sentry-go`.

Runtime secrets and endpoints are environment/ops configuration:

- web: `VITE_SENTRY_DSN`, `VITE_APP_VERSION`, `VITE_POSTHOG_KEY`,
  `VITE_POSTHOG_HOST`, `VITE_COSIMOSI_FLAG_*`;
- API: `COSIMOSI_SENTRY_DSN`, `COSIMOSI_RELEASE`;
- mobile: provider props (`sentryDsn`, `release`, optional native PostHog-compatible
  client) until the mobile shell owns a runtime env source.

The API entrypoint handles SIGINT/SIGTERM with `http.Server.Shutdown` and calls the
reporter flush path on graceful shutdown or fatal listen errors, so buffered Sentry
events have a bounded delivery window before process exit.

No production dashboard, alerting process, source-map upload pipeline, billing policy,
or product A/B experiment is introduced by this unit.
