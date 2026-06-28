import { useEffect, type ReactNode } from 'react';

import { resolveLocale, setActiveLocale, type Locale } from '@cosimosi/i18n';

import { readDeviceLocale } from './device-locale';

interface MobileI18nProviderProps {
  children?: ReactNode;
  /** Skip device negotiation and force a locale (tests, storybook). */
  locale?: Locale;
  /** Override the device-locale source (tests). */
  deviceLocale?: string;
}

export function MobileI18nProvider({ children, locale: override, deviceLocale }: MobileI18nProviderProps) {
  // Negotiate once on mount: device locale → default fallback (resolveLocale).
  useEffect(() => {
    if (override) {
      setActiveLocale(override);
      return;
    }
    setActiveLocale(resolveLocale([deviceLocale ?? readDeviceLocale()]));
  }, [override, deviceLocale]);

  return <>{children}</>;
}
