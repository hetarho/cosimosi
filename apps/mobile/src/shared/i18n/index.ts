import { useSyncExternalStore } from 'react';

import { getActiveLocale, subscribeLocale, type Locale } from '@cosimosi/i18n';

// The app-local i18n seam, mirroring apps/web. UI imports message functions and
// the reactive locale hook from here; the platform-pure catalogue + store live in
// @cosimosi/i18n, the device-locale provider in app/. (ARCHITECTURE §3.1, §3.5.)
export { m } from '@cosimosi/i18n';

/** Subscribe to the active locale so a component re-renders when it changes. */
export function useActiveLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getActiveLocale, getActiveLocale);
}
