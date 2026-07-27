import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

import { getActiveLocale, subscribeLocale, type Locale } from './locale.ts'

export {
  defaultLocale,
  getActiveLocale,
  m,
  matchLocale,
  resolveDeviceTimeZone,
  resolveLocale,
  setActiveLocale,
  subscribeLocale,
  supportedLocales,
  type Locale,
} from './index.ts'
export { LocaleBootstrap } from './locale-bootstrap.ts'

const ActiveLocaleContext = createContext<Locale | null>(null)

interface ActiveLocaleProviderProps {
  children?: ReactNode
}

/**
 * Bridges the platform-pure locale store into React without making message
 * functions hook-only. App composition roots consume the value through
 * LocaleRenderBoundary so their existing synchronous m.*() calls are evaluated
 * again while mounted state remains intact.
 */
export function ActiveLocaleProvider({ children }: ActiveLocaleProviderProps) {
  const locale = useActiveLocaleStore()
  return createElement(ActiveLocaleContext.Provider, { value: locale }, children)
}

interface LocaleRenderBoundaryProps {
  children: (locale: Locale) => ReactNode
}

export function LocaleRenderBoundary({ children }: LocaleRenderBoundaryProps) {
  const locale = useContext(ActiveLocaleContext)
  if (locale === null) {
    throw new Error('LocaleRenderBoundary must be rendered inside ActiveLocaleProvider')
  }
  return children(locale)
}

export function useActiveLocale(): Locale {
  const contextLocale = useContext(ActiveLocaleContext)
  const storeLocale = useActiveLocaleStore()
  return contextLocale ?? storeLocale
}

function useActiveLocaleStore(): Locale {
  return useSyncExternalStore(subscribeLocale, getActiveLocale, getActiveLocale)
}
