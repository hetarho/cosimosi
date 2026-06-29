import {useEffect, type ReactNode} from 'react';

import {resolveLocale, setActiveLocale, type Locale} from '@cosimosi/i18n';

import {readDeviceLocale} from '../../shared/native/index.ts';

interface MobileI18nProviderProps {
  children?: ReactNode;
  /** Skip device negotiation and force a locale (tests, storybook). */
  locale?: Locale;
  /** Override the device-locale source (tests). */
  deviceLocale?: string;
}

export function MobileI18nProvider({children, locale: override, deviceLocale}: MobileI18nProviderProps) {
  // Negotiate in a mount effect (no external-store writes during render, so the
  // provider stays pure under concurrent rendering). Product screens render only
  // after the boot gate — by then this effect has run — so they paint in the right
  // locale; only the transient Boot spinner can show the default locale for a frame.
  useEffect(() => {
    setActiveLocale(override ?? resolveLocale([deviceLocale ?? readDeviceLocale()]));
  }, [override, deviceLocale]);

  return <>{children}</>;
}
