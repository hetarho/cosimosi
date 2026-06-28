import { resolveLocale, type Locale } from '@cosimosi/i18n'

/** Where an explicit web locale choice is stored (a future language switcher writes here). */
export const WEB_LOCALE_STORAGE_KEY = 'cosimosi.locale'

export interface WebLocaleSources {
  /** A previously stored explicit choice, if any. */
  stored?: string | null
  /** Browser languages in preference order (e.g. `navigator.languages`). */
  languages?: readonly string[]
}

/**
 * Web locale precedence: explicit/stored choice → browser languages → default.
 * Pure — the provider supplies the platform values, so this is testable without
 * `window`/`navigator` (plan/08 A5).
 */
export function resolveWebLocale({ stored, languages = [] }: WebLocaleSources): Locale {
  return resolveLocale([stored, ...languages])
}
