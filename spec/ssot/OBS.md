# OBS observability & flags
> r1 | the privacy-aware telemetry seam (error reports, consented analytics, request ids, logs) and the typed feature-flag registry on web, mobile and API

## decisions
- OBS-1 [o] app and domain code reach telemetry only through the `@cosimosi/observability` facade (web, mobile) or the API reporter (`internal/platform/observability`); a vendor SDK is imported only at its one boundary file
  | runtime | vendor | boundary file |
  |---|---|---|
  | web | `@sentry/react`, `posthog-js` | `apps/web/src/app/providers/observability-provider.tsx` |
  | mobile | `@sentry/react-native`, an injected PostHog-compatible client | `apps/mobile/src/app/providers/observability-provider.tsx` and its focused test |
  | API | `github.com/getsentry/sentry-go` | `apps/api/internal/platform/observability/sentry.go` |
  - facade calls: `captureException`, `captureMessage`, `track`, `identify`, `resetIdentity`, `setConsent`, `setRequestId`, `getFeatureFlag`
  - `packages/observability` owns the facade, the consent gate, safe-property typing, the in-memory adapter, the flag registry, the Connect request-id interceptor and the React provider and error boundary
  - guard `pnpm lint:observability` (`scripts/check-observability-boundaries.mjs`) scans `apps/web/src`, `apps/mobile/src`, `packages`, `apps/api/internal`, `apps/api/cmd` and `apps/blog/src`; it matches quoted specifiers by prefix, so subpath and dynamic imports fail too
  - `apps/api/cmd` has an empty allowlist: the composition root sees every concrete, so the SDK must still arrive through the platform adapter; `apps/blog/src` is scanned before it has any telemetry
  - liveness anchors require each boundary file to still import its SDK; `--probe` proves an offender is reported and that the anchored allowlist spares only the named file, never a lookalike beside it →~ARCH-43
- OBS-2 [o] telemetry has two classes: operational error reports may flow before analytics consent, analytics and identification never do
  | class | calls | before consent |
  |---|---|---|
  | operational errors | `captureException`, `captureMessage` | sent, content-free →!OBS-3 |
  | analytics and identity | `track`, `identify` | blocked and counted (`blockedAnalyticsCalls`) |
  - consent starts `denied`; `setConsent('granted')` opens analytics; `setConsent('denied')` stops it and resets vendor identity where the vendor supports it
  - an operational report identifies nothing beyond the request id →~OBS-6
  - each app's session bridge calls `identify(userId, { surface })` while a session exists and `resetIdentity()` when it ends; the consent gate decides whether either reaches a vendor
  - no product surface grants consent, so analytics and identification stay inert until a consent surface exists
- OBS-3 [o] telemetry never carries personal or secret content: no diary text, memory or generated content, raw embeddings, tokens, credentials, payload bodies or raw exception messages
  - a captured exception is reduced to a safe identifier-like error name (otherwise `Error`), the fixed message `operational error` and no stack
  - FE property bags: `SafeTelemetryProperties<T>` rejects credential keys (token variants, `authorization`, `apiKey`, `secret`, `password`) at type-check time for literals, and `assertSafeTelemetryProperties` rejects them at runtime for dynamic bags; product content stays out through DTO design and call-site review
  - API attributes are `observability.Attributes`, built only through `NewAttributes` or `MustAttributes`, which refuse credential keys and product-content keys (`diary`, `diaryText`, `memoryContent`, `generatedMemoryContent`, `embedding`, `rawEmbedding`, `recordBody`); keys compare case- and separator-insensitively
  - what reaches the wire is the error contract's →~ERR-6
- OBS-4 [o] vendor SDKs run with privacy defaults and are off without keys
  - Sentry on web and mobile: `defaultIntegrations: false`, `sendDefaultPii: false`, fed only facade-redacted exceptions; the API's `sentry-go` runs with `SendDefaultPII: false`
  - PostHog on web: opted out by default, no autocapture, no pageview capture, no session recording
  - an empty DSN or key leaves that vendor off; with neither, the app runs with no vendor adapter and the API on `NoopReporter`
  - vendor adapters attach from effects through a delegated adapter, never during render, and receive the current consent when attached; the facade stays stable across StrictMode replays; mobile closes its previous Sentry binding before reinitializing
  - the app error boundary reports what it catches through `captureException` and exposes a reset render prop and reset keys, so each shell renders its own recovery UI →~ERR-17
- OBS-5 [o] the API reports only from the RPC boundary, with content-free attributes (`source`, `method`, `request_id`, `rpc_code`, `reason`)
  | failure | reported as | discriminator |
  |---|---|---|
  | `Internal` or `Unknown` error | `unexpected rpc error` | `error_type`: the Go type name |
  | recovered panic | `rpc panic recovered` | `panic_type`: the type of the recovered value |
  | domain refusal marked `apperr.Reported` | `reported domain failure: <REASON>`, grouped by reason | the refusal's own metadata as `detail_*` |
  - never the raw error message or the panic value
  - telemetry never fails a request: metadata the attribute guard refuses degrades to the base attributes
  - known application and auth errors are not reported as unexpected
  - masking, the `Reported` mark and `debug_detail` belong to the error contract →~ERR-5 →~ERR-7 →~ERR-9
  - the worker process carries no reporter: job failures surface in its log and in the queue's retry and dead-letter state →~AI
- OBS-6 [o] the API is the source of the request id (`X-Request-Id`): a client-sent id survives only as a safe token, otherwise the server mints one before anything logs or reports it
  - safe token: 1–128 characters from `A-Z a-z 0-9 . _ - :`; the replacement comes from `platform.NewID`
  - every response carries it (the header is CORS-exposed), and every failed response also carries it in `ErrorInfo.request_id` →~ERR-4
  - the FE Connect interceptor (`createTelemetryRequestIdInterceptor`) prefers the error-detail id, validates it with the same rule, falls back to response metadata and stores it through `setRequestId`; later captures and events carry it
- OBS-7 [o] the API writes one log line per RPC: method, request id, status and duration; a failed call's line adds the raw error cause, which stays in server logs and never reaches telemetry or the wire
  - no log line carries payload bodies, diary text, memory or generated content, embeddings, tokens or secrets; error text is never assembled from them, which is what makes the raw cause safe to log →~ERR-6
  - a recovered panic logs method and request id only
- OBS-8 [o] the API shuts down gracefully: SIGINT and SIGTERM drive `http.Server.Shutdown`, and the reporter is flushed on graceful shutdown or a fatal listen error, so buffered events get a bounded delivery window
  - the shutdown and flush budgets are named constants at `cmd/api` →~ARCH-33
- OBS-9 [o] feature flags are boolean entries of one typed registry (`platformFeatureFlags`, built by `defineFeatureFlagRegistry`), read only through `getFeatureFlag`; tuning numbers are never flags →~ARCH-33
  | kind | remote value consulted |
  |---|---|
  | `release` | only after analytics consent |
  | `operational`, `kill-switch` | before consent too: they control safety and operation, not analytics identity |
  - a definition carries `key`, `defaultValue`, `owner`, `kind`, `description`, `review` and an optional `remoteKey`
  - resolution: local override, then remote value, then committed default; a missing or disabled remote value falls back to the default
  - overrides are registry-level, never scattered conditionals: env `VITE_COSIMOSI_FLAG_<KEY>` on web and `COSIMOSI_FLAG_<KEY>` on mobile, accepting `true`, `1`, `false` or `0`; any other value throws
  - the registry fails at definition on an unknown override key or on two keys deriving the same env name
- OBS-10 [o] the one shipped flag is `platform.diagnosticsSurface` (`operational`, default `false`): it opens the dev diagnostics surfaces and is never a product experiment
  - it gates the web `/test` route in production builds (dev builds always reach it), the web universe canvas performance HUD, the mobile diagnostics screen and the mobile test page →~ARCH-49
- OBS-11 [o] telemetry endpoints and keys are runtime environment config, never `values.yaml`: DSNs, keys, release tags, sample rates, consent defaults, remote flag state
  | runtime | keys |
  |---|---|
  | web, at build | `VITE_SENTRY_DSN`, `VITE_APP_VERSION`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_COSIMOSI_FLAG_*` |
  | API | `COSIMOSI_SENTRY_DSN`, `COSIMOSI_RELEASE` |
  | mobile | provider props `sentryDsn` and `release`, an injected PostHog-compatible client; `COSIMOSI_FLAG_*` |
  - where each value is set for a deployed stack →~ARCH-50
- OBS-12 [o] local runs and suites use in-memory telemetry and never need a vendor secret: `createInMemoryTelemetryAdapter` on the FE, `InMemoryReporter` and `NoopReporter` on the API
- OBS-13 [o] no product dashboards, alert routing or on-call, source-map upload, billing or cost monitoring, data warehouse, A/B experiments or remote config for tuning values; no metrics or distributed-tracing pipeline exists
  - AI cost metering and the admin usage view are product features, not this seam →~AI →~ADMIN

## constraints
- OBS owns no `values.yaml` group

## chg
- r1 261102 initial
