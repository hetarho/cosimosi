import { useEffect, type ReactNode } from 'react'

import {
  ActiveLocaleProvider,
  resolveLocale,
  setActiveLocale,
  type Locale,
} from '../../shared/i18n/index.ts'
import { readDeviceLocale } from '../../shared/native/index.ts'

interface MobileI18nProviderProps {
  children?: ReactNode
  /** Skip device negotiation and force a locale (tests, storybook). */
  locale?: Locale
  /** Override the device-locale source (tests). */
  deviceLocale?: string
}

export function MobileI18nProvider({
  children,
  locale: override,
  deviceLocale,
}: MobileI18nProviderProps) {
  // Negotiate in a mount effect (no external-store writes during render, so the
  // provider stays pure under concurrent rendering). A signed-in profile may
  // apply a later locale after product screens have painted; ActiveLocaleProvider
  // carries that later write into the app's LocaleRenderBoundary.
  useEffect(() => {
    setActiveLocale(override ?? resolveLocale([deviceLocale ?? readDeviceLocale()]))
  }, [override, deviceLocale])

  return <ActiveLocaleProvider>{children}</ActiveLocaleProvider>
}
