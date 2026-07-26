import { resolveLocale, setActiveLocale, type Locale } from '@cosimosi/i18n'

import { readDeviceLocale } from './device-locale.ts'

/** Mobile deliberately has no durable preference store; the server owns signed-in persistence. */
export function writeStoredLocale(_locale: Locale): void {}

/** Return a signed-out mobile process to its device negotiation after a user-scope change. */
export function resetMobileLocaleUserState(): void {
  setActiveLocale(resolveLocale([readDeviceLocale()]))
}
