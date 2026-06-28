import { StyleSheet, Text, View } from 'react-native';

import { MobileAuthProvider } from './auth-provider';
import { MobileClientCacheProvider } from './query-provider';

export default function App() {
  return (
    <MobileAuthProvider>
      <MobileClientCacheProvider>
        <View style={styles.container}>
          <Text>hello world</Text>
        </View>
      </MobileClientCacheProvider>
    </MobileAuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
