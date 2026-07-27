import { resolveLocale, type Locale } from '../../shared/i18n/index.ts'

export interface WebLocaleSources {
  /** A previously stored explicit choice, if any. */
  stored?: string | null
  /** Browser languages in preference order (e.g. `navigator.languages`). */
  languages?: readonly string[]
}

/**
 * Web locale precedence: explicit/stored choice → browser languages → default.
 * Pure — the provider supplies the platform values, so this is testable without
 * `window`/`navigator`.
 */
export function resolveWebLocale({ stored, languages = [] }: WebLocaleSources): Locale {
  return resolveLocale([stored, ...languages])
}
