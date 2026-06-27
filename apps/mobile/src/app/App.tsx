import { StyleSheet, Text, View } from 'react-native';

import { MobileAuthProvider } from './auth-provider';

export default function App() {
  return (
    <MobileAuthProvider>
      <View style={styles.container}>
        <Text>hello world</Text>
      </View>
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
