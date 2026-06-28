/**
 * @cosimosi/i18n — the platform-pure UI string seam.
 *
 * Both apps/web and apps/mobile consume this package. It stays free of DOM/native
 * deps (ARCHITECTURE §3.1, §3.5): messages compile to tree-shakeable typed
 * functions and locale is an owned in-memory store, so the same `m.*` calls run
 * verbatim on web, React Native, and in Node tests.
 *
 * Usage:
 * - call message functions for any user-facing copy — `m.app_greeting()`;
 * - each app's locale provider resolves a locale (web: stored/route/navigator;
 *   mobile: device locale) via `resolveLocale(...)` and applies it with
 *   `setActiveLocale(...)`; components observe it through `subscribeLocale` +
 *   `getActiveLocale` (e.g. React's `useSyncExternalStore`).
 *
 * The React binding seam (provider + hook) lives in each app under app/, because
 * locale negotiation is platform-specific; this package owns only the pure parts.
 *
 * Message sources are packages/i18n/messages/{en,ko}.json; `pnpm gen:messages`
 * compiles them into ./gen (committed, freshness-checked by check:gen). Canonical
 * domain terms stay in ubiquitous-language.md and never become message keys.
 */
export { m } from './gen/messages.js'
export {
  type Locale,
  supportedLocales,
  defaultLocale,
  matchLocale,
  resolveLocale,
  getActiveLocale,
  setActiveLocale,
  subscribeLocale,
} from './locale.ts'
