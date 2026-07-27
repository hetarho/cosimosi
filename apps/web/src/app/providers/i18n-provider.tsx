import { useEffect, type ReactNode } from 'react'

import {
  ActiveLocaleProvider,
  setActiveLocale,
  useActiveLocale,
  type Locale,
} from '../../shared/i18n/index.ts'
import { readStoredLocale } from '../../shared/lib/locale-storage.ts'
import { resolveWebLocale } from './i18n-config.ts'

interface WebI18nProviderProps {
  children?: ReactNode
  /** Skip browser negotiation and force a locale (tests, storybook). */
  locale?: Locale
}

export function WebI18nProvider({ children, locale: override }: WebI18nProviderProps) {
  // Locale negotiation writes to the external store only from effects, keeping
  // render free of global store mutation, window, and navigator access.
  useEffect(() => {
    if (override) {
      setActiveLocale(override)
      return
    }
    setActiveLocale(
      resolveWebLocale({
        stored: readStoredLocale(),
        languages: navigator.languages ?? [navigator.language],
      }),
    )
  }, [override])

  return (
    <ActiveLocaleProvider>
      <DocumentLocaleSync>{children}</DocumentLocaleSync>
    </ActiveLocaleProvider>
  )
}

function DocumentLocaleSync({ children }: { children?: ReactNode }) {
  const locale = useActiveLocale()

  // Keep <html lang> in sync for assistive tech; index.html ships a static lang
  // and this corrects it to the resolved locale.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return children
}
