import { resolveLocale, setActiveLocale, type Locale } from '@cosimosi/i18n'

const WEB_LOCALE_STORAGE_KEY = 'cosimosi.locale'

export function readStoredLocale(): string | null {
  try {
    return window.localStorage.getItem(WEB_LOCALE_STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeStoredLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(WEB_LOCALE_STORAGE_KEY, locale)
  } catch {
    // Server persistence remains authoritative when local storage is unavailable.
  }
}

/** Restore the signed-out web negotiation without erasing the durable local choice. */
export function resetWebLocaleUserState(): void {
  const languages =
    typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])
  setActiveLocale(resolveLocale([readStoredLocale(), ...languages]))
}
