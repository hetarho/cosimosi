import { useSyncExternalStore } from 'react'

import { getActiveLocale, subscribeLocale, type Locale } from '@cosimosi/i18n'

// The app-local i18n seam. UI imports message functions and the reactive locale
// hook from here; the platform-pure catalogue + store live in @cosimosi/i18n, and
// the negotiating provider lives in app/. (ARCHITECTURE §3.1 — shared/i18n.)
export { m, setActiveLocale, supportedLocales, type Locale } from '@cosimosi/i18n'

/**
 * Subscribe to the active locale so a component re-renders when it changes.
 * Components that render `m.*` copy call this to stay reactive to locale switches.
 */
export function useActiveLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getActiveLocale, getActiveLocale)
}
