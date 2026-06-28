import {
  baseLocale,
  isLocale,
  locales,
  overwriteGetLocale,
  overwriteSetLocale,
} from './gen/runtime.js'

/** A locale this app ships messages for. */
export type Locale = (typeof locales)[number]

/** The shipped locales, in declaration order (precedence for fallbacks). */
export const supportedLocales: readonly Locale[] = locales

/** The locale used whenever no candidate resolves to a supported one. */
export const defaultLocale: Locale = baseLocale

/**
 * Map a BCP-47-ish tag to a supported locale, or `undefined` when none matches.
 * Tries the exact tag, then its primary subtag, case-insensitively and across both
 * separators ("en-US" / "ko_KR" → "en" / "ko") since device locales use either.
 * Pure — takes a string and touches no platform globals, so it is unit-testable.
 */
export function matchLocale(tag: string | null | undefined): Locale | undefined {
  if (!tag) return undefined
  const lower = tag.toLowerCase()
  if (isLocale(lower)) return lower
  const primary = lower.split(/[-_]/)[0]
  if (isLocale(primary)) return primary
  return undefined
}

/**
 * Resolve the first candidate that matches a supported locale, else the default.
 * Each platform's provider passes candidates in precedence order (web: stored
 * choice → navigator language → default; mobile: device locale → default), which
 * keeps locale resolution here platform-pure and testable without browser globals.
 */
export function resolveLocale(candidates: ReadonlyArray<string | null | undefined>): Locale {
  for (const candidate of candidates) {
    const matched = matchLocale(candidate)
    if (matched) return matched
  }
  return defaultLocale
}

let activeLocale: Locale = defaultLocale
const listeners = new Set<() => void>()

function applyLocale(next: Locale): void {
  if (next === activeLocale) return
  activeLocale = next
  for (const notify of listeners) notify()
}

// Drive Paraglide's locale from this owned, in-memory store: message functions
// (m.*) read whatever locale each app set, with no cookie/URL/DOM coupling. This
// is what keeps the facade importable verbatim from web, React Native, and Node
// tests. Persistence/negotiation belongs to each app's provider, not here.
overwriteGetLocale(() => activeLocale)
overwriteSetLocale((next) => applyLocale(matchLocale(next) ?? defaultLocale))

/** The locale currently driving message functions. */
export function getActiveLocale(): Locale {
  return activeLocale
}

/** Set the active locale and notify subscribers. Callers resolve to a supported locale first. */
export function setActiveLocale(next: Locale): void {
  applyLocale(next)
}

/** Subscribe to active-locale changes; returns an unsubscribe. Pairs with `useSyncExternalStore`. */
export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
