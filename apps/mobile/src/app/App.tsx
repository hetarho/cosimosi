import { ObservedErrorBoundary, type ObservedErrorBoundaryFallbackProps } from '@cosimosi/observability/react';
import { m } from '@cosimosi/i18n';
import { Button } from '@cosimosi/ui';
import { StyleSheet, View } from 'react-native';

import { MobileAuthProvider } from './auth-provider';
import { MobileI18nProvider } from './i18n-provider';
import { MobileObservabilityProvider, MobileObservabilitySessionBridge } from './observability-provider';
import { MobileClientCacheProvider } from './query-provider';
import { UiShowcase } from './ui-showcase.stories.tsx';

export default function App() {
  return (
    <MobileObservabilityProvider>
      <ObservedErrorBoundary fallback={MobileAppErrorFallback}>
        <MobileI18nProvider>
          <MobileAuthProvider>
            <MobileObservabilitySessionBridge />
            <MobileClientCacheProvider>
              <UiShowcase />
            </MobileClientCacheProvider>
          </MobileAuthProvider>
        </MobileI18nProvider>
      </ObservedErrorBoundary>
    </MobileObservabilityProvider>
  );
}

function MobileAppErrorFallback({ resetErrorBoundary }: ObservedErrorBoundaryFallbackProps) {
  return (
    <View style={styles.errorFallback}>
      <Button onPress={resetErrorBoundary}>{m.common_retry()}</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  errorFallback: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
});
