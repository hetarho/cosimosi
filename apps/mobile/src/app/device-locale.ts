import { NativeModules, Platform } from 'react-native';

/**
 * Best-effort device locale via React Native's built-in native modules — no extra
 * native dependency. Returns a BCP-47-ish tag ("en-US", "ko_KR") or undefined; the
 * i18n facade's resolveLocale normalizes it and falls back to the default locale.
 */
export function readDeviceLocale(): string | undefined {
  try {
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      return settings?.AppleLocale ?? settings?.AppleLanguages?.[0];
    }
    return NativeModules.I18nManager?.localeIdentifier;
  } catch {
    return undefined;
  }
}
