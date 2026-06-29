import {useEffect, useRef, useState, type ReactNode} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {useQueryClient} from '@tanstack/react-query';

import {createPlatformClient} from '@cosimosi/api-client';
import {m} from '@cosimosi/i18n';
import {platformFeatureFlags} from '@cosimosi/observability';
import {useObservabilityFacade} from '@cosimosi/observability/react';
import {Button, tokens, useTheme} from '@cosimosi/ui';

import {diagnosticsSurfaceFlag, mobileAppVersion} from '../../shared/config/index.ts';
import {useActiveLocale} from '../../shared/i18n/index.ts';
import {useMobileApiBaseUrl, useMobileApiTransport, useSessionSnapshot} from '../providers/index.ts';
import {type RootStackScreenProps} from '../navigation/routes.ts';

type PingState = {kind: 'idle' | 'pending' | 'ok' | 'error'; text: string};

/**
 * Provider-health surface — not a product screen. It reports locale, theme,
 * session status, API base URL + a live transport ping, query-cache size, and
 * feature-flag defaults. It never shows tokens, diary text, generated memory
 * content, embeddings, or any product data (plan/13 A7), and it is reachable only
 * while the platform diagnostics-surface flag is on.
 */
export function DiagnosticsScreen({navigation}: RootStackScreenProps<'Diagnostics'>) {
  const observability = useObservabilityFacade();
  const enabled = observability.getFeatureFlag(diagnosticsSurfaceFlag);
  const locale = useActiveLocale();
  const {theme} = useTheme();
  const session = useSessionSnapshot();
  const queryClient = useQueryClient();
  const transport = useMobileApiTransport();
  const apiBaseUrl = useMobileApiBaseUrl();
  const [ping, setPing] = useState<PingState>({kind: 'idle', text: m.mobile_diagnostics_ping_idle()});
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  if (!enabled) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.description}>{m.mobile_diagnostics_unavailable()}</Text>
        <Button variant="ghost" onPress={() => navigation.goBack()}>
          {m.mobile_diagnostics_back()}
        </Button>
      </View>
    );
  }

  const runPing = async () => {
    setPing({kind: 'pending', text: m.common_loading()});
    try {
      const response = await createPlatformClient(transport).ping({});
      if (mounted.current) setPing({kind: 'ok', text: response.message});
    } catch (error) {
      if (mounted.current) {
        setPing({kind: 'error', text: error instanceof Error ? error.message : m.mobile_diagnostics_unknown_error()});
      }
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{m.mobile_diagnostics_title()}</Text>
      <Text style={styles.description}>{m.mobile_diagnostics_description()}</Text>

      <Row label={m.mobile_diagnostics_app_version()} value={mobileAppVersion} />
      <Row label={m.mobile_diagnostics_locale()} value={locale} />
      <Row label={m.mobile_diagnostics_theme()} value={theme} />
      <Row label={m.mobile_diagnostics_session_status()} value={session.status} />
      <Row label={m.mobile_diagnostics_api_base_url()} value={apiBaseUrl} />
      <Row label={m.mobile_diagnostics_query_entries()} value={String(queryClient.getQueryCache().getAll().length)} />

      <View style={styles.pingRow}>
        <Row label={m.mobile_diagnostics_transport_ping()} value={ping.text} />
        <Button variant="secondary" onPress={runPing} loading={ping.kind === 'pending'}>
          {m.mobile_diagnostics_ping_action()}
        </Button>
      </View>

      <Text style={styles.sectionTitle}>{m.mobile_diagnostics_flags()}</Text>
      {platformFeatureFlags.definitions.map(definition => (
        <Row
          key={definition.key}
          label={definition.key}
          value={String(observability.getFeatureFlag(definition.key))}
        />
      ))}

      <View style={styles.backRow}>
        <Button variant="ghost" onPress={() => navigation.goBack()}>
          {m.mobile_diagnostics_back()}
        </Button>
      </View>
    </ScrollView>
  );
}

function Row({label, value}: {label: string; value: ReactNode}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {backgroundColor: tokens.color.bg, flex: 1},
  content: {gap: 12, padding: 24},
  unavailable: {alignItems: 'center', flex: 1, gap: 16, justifyContent: 'center', padding: 24},
  title: {color: tokens.color.text, fontSize: 22, fontWeight: '600'},
  description: {color: tokens.color['text-muted'], fontSize: 14, lineHeight: 20},
  sectionTitle: {
    color: tokens.color['text-subtle'],
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  row: {
    borderBottomColor: tokens.color.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rowLabel: {color: tokens.color['text-muted'], flexShrink: 1, fontSize: 14},
  rowValue: {color: tokens.color.text, fontSize: 14, fontWeight: '500', marginLeft: 12, textAlign: 'right'},
  pingRow: {gap: 8},
  backRow: {marginTop: 12},
});
