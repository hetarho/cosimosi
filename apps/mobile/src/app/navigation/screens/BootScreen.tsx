import {useEffect} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

import {m} from '@cosimosi/i18n';
import {tokens} from '@cosimosi/ui';

import {AppShellActor, useSessionSnapshot} from '../../providers/index.ts';
import {ROUTES, type RootStackScreenProps} from '../routes.ts';

/**
 * Transient boot route. Sends the shell-lifecycle actor `READY` once the session
 * seam leaves its bootstrapping state, then resets navigation to ShellHome so the
 * boot route can never be returned to via the back stack.
 */
export function BootScreen({navigation}: RootStackScreenProps<'Boot'>) {
  const session = useSessionSnapshot();
  const actor = AppShellActor.useActorRef();
  const isReady = AppShellActor.useSelector(state => state.matches('ready'));

  useEffect(() => {
    if (session.status !== 'bootstrapping') actor.send({type: 'READY'});
  }, [actor, session.status]);

  useEffect(() => {
    if (isReady) navigation.reset({index: 0, routes: [{name: ROUTES.shellHome}]});
  }, [isReady, navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={tokens.color.primary} />
      <Text style={styles.label}>{m.common_loading()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 24},
  label: {color: tokens.color['text-muted'], fontSize: 14},
});
