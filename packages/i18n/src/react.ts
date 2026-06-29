import { useSyncExternalStore } from 'react'

import { getActiveLocale, subscribeLocale, type Locale } from './locale.ts'

export { m, setActiveLocale, supportedLocales, type Locale } from './index.ts'

export function useActiveLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getActiveLocale, getActiveLocale)
}
