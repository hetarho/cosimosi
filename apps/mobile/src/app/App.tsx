import { StyleSheet, Text, View } from 'react-native';

import { m, useActiveLocale } from '../shared/i18n/index.ts';
import { MobileAuthProvider } from './auth-provider';
import { MobileI18nProvider } from './i18n-provider';
import { MobileClientCacheProvider } from './query-provider';

export default function App() {
  return (
    <MobileI18nProvider>
      <MobileAuthProvider>
        <MobileClientCacheProvider>
          <Greeting />
        </MobileClientCacheProvider>
      </MobileAuthProvider>
    </MobileI18nProvider>
  );
}

function Greeting() {
  useActiveLocale(); // re-render this copy when the locale changes
  return (
    <View style={styles.container}>
      <Text>{m.app_greeting()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
