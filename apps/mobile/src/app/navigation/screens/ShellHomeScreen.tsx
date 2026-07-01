import {StyleSheet, Text, View} from 'react-native';

import {m} from '@cosimosi/i18n';
import {useObservabilityFacade} from '@cosimosi/observability/react';
import {Button, tokens} from '@cosimosi/ui';

import {diagnosticsSurfaceFlag} from '../../../shared/config/index.ts';
import {ROUTES, type RootStackScreenProps} from '../routes.ts';

/**
 * Neutral placeholder confirming the shell is ready. The diagnostics entry only
 * appears when the platform diagnostics-surface flag is on, so production builds
 * hide it without a code change.
 */
export function ShellHomeScreen({navigation}: RootStackScreenProps<'ShellHome'>) {
  const observability = useObservabilityFacade();
  const diagnosticsEnabled = observability.getFeatureFlag(diagnosticsSurfaceFlag);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{m.mobile_shell_home_title()}</Text>
      <Text style={styles.description}>{m.mobile_shell_home_description()}</Text>
      <Button variant="primary" onPress={() => navigation.navigate(ROUTES.universe)}>
        {m.universe_home_explore()}
      </Button>
      {diagnosticsEnabled ? (
        <Button variant="secondary" onPress={() => navigation.navigate(ROUTES.diagnostics)}>
          {m.mobile_shell_open_diagnostics()}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, gap: 16, justifyContent: 'center', padding: 24},
  title: {color: tokens.color.text, fontSize: 22, fontWeight: '600'},
  description: {color: tokens.color['text-muted'], fontSize: 15, lineHeight: 22},
});
