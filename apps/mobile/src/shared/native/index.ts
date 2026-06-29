// Native-adapter seams for the mobile shell (ARCHITECTURE §3.5). Every native
// device concern the shell touches — device locale, secure token storage, inbound
// links, safe-area metrics — is wrapped here so feature/domain slices stay pure.
export {readDeviceLocale} from './device-locale.ts';
export {
  createInMemorySecureTokenStorage,
  type SecureTokenStorage,
} from './secure-token-storage.ts';
export {mobileLinkingPrefixes} from './linking.ts';
export {fallbackSafeAreaMetrics, resolvedSafeAreaMetrics} from './safe-area.ts';
