import { cx } from '@cosimosi/ui'

import { m, supportedLocales, type Locale } from '../../../shared/i18n/index.ts'

const LOCALE_LABEL: Readonly<Record<Locale, () => string>> = {
  en: m.landing_locale_en,
  ko: m.landing_locale_ko,
}

// The public language switch — the first writer of the stored locale reachable without a session.
//
// Deliberately not a shared slice with `/me`'s language control: that one writes `UpdateProfile` for a
// signed-in user, a different operation with a different authority. The only genuinely common part is the
// negotiation, and that already lives below both.
//
// The page cannot persist the choice itself (`pages` may not import `app`), so it reports the chosen
// locale through a callback the route wrapper injects.
export function LandingLocaleSwitch({
  locale,
  onSelectLocale,
}: {
  locale: Locale
  onSelectLocale: (next: Locale) => void
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={m.landing_locale_label()}>
      {supportedLocales.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === locale}
          onClick={() => onSelectLocale(option)}
          className={cx(
            'rounded-md px-2 py-1 text-xs',
            option === locale ? 'text-text' : 'text-text-subtle hover:text-text-muted',
          )}
        >
          {LOCALE_LABEL[option]()}
        </button>
      ))}
    </div>
  )
}
