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
  // Negotiate the locale once on mount, in an effect rather than during render, so
  // render touches no window/navigator — SSR- and test-safe.
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
