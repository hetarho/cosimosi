import { useEffect, type ReactNode } from 'react'

import { setActiveLocale, type Locale } from '@cosimosi/i18n'

import { useActiveLocale } from '../shared/i18n/index.ts'
import { resolveWebLocale, WEB_LOCALE_STORAGE_KEY } from './i18n-config.ts'

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

  // Keep <html lang> in sync for assistive tech; index.html ships a static lang
  // and this corrects it to the resolved locale.
  const locale = useActiveLocale()
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return <>{children}</>
}

function readStoredLocale(): string | null {
  try {
    return window.localStorage.getItem(WEB_LOCALE_STORAGE_KEY)
  } catch {
    return null
  }
}
