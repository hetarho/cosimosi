import {StatusBar} from 'react-native';
import {SafeAreaProvider, type Metrics} from 'react-native-safe-area-context';

import {tokens} from '@cosimosi/ui';

import {NavigationRoot, type NavigationRootProps} from './navigation/index.ts';
import {MobileAppProviders, type MobileAppProvidersProps} from './providers/index.ts';
import {resolvedSafeAreaMetrics} from '../shared/native/index.ts';

export interface AppProps extends Omit<MobileAppProvidersProps, 'children'> {
  /** Safe-area metrics; the device window in production, fixed metrics in host tests. */
  safeAreaMetrics?: Metrics;
  /** Deep-linking config passthrough; host tests pass `null` to skip the native path. */
  navigationLinking?: NavigationRootProps['linking'];
}

/**
 * Mobile app shell. A thin composition root: native shell (safe area + status bar)
 * wraps the documented provider stack, which wraps the typed navigation tree. All
 * adapters are injectable so the shell renders in host tests without Supabase, a
 * real API, or native device features.
 */
export default function App({safeAreaMetrics = resolvedSafeAreaMetrics, navigationLinking, ...providers}: AppProps = {}) {
  return (
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <StatusBar barStyle="light-content" backgroundColor={tokens.color.bg} />
      <MobileAppProviders {...providers}>
        <NavigationRoot linking={navigationLinking} />
      </MobileAppProviders>
    </SafeAreaProvider>
  );
}
