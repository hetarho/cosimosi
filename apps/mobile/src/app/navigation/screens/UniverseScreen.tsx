import {StyleSheet, Text, View} from 'react-native';

import {Button, tokens} from '@cosimosi/ui';
import {m} from '@cosimosi/i18n';
import {
  ObservedErrorBoundary,
  type ObservedErrorBoundaryFallbackProps,
} from '@cosimosi/observability/react';

import {UniverseCanvasWidget} from '../../../widgets/universe-canvas/index.ts';

// The universe screen: the real memory universe full-bleed with a floating action over
// it. The shared widget owns the whole 3D block (renderer mount, GetUniverse read, sim,
// camera rig) — the same slice as web (§3.5). Error-boundaried so a WebGPU/native
// failure shows a fallback instead of crashing.
function RendererFallback({resetErrorBoundary}: ObservedErrorBoundaryFallbackProps) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>{m.universe_renderer_unavailable()}</Text>
      <Button variant="secondary" onPress={resetErrorBoundary}>
        {m.common_retry()}
      </Button>
    </View>
  );
}

export function UniverseScreen() {
  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <ObservedErrorBoundary fallback={RendererFallback}>
          <UniverseCanvasWidget />
        </ObservedErrorBoundary>
      </View>
      <View style={styles.hud}>
        <Button>{m.universe_home_write()}</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  hud: {position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center'},
  fallback: {flex: 1, gap: 16, alignItems: 'center', justifyContent: 'center', padding: 24},
  fallbackText: {color: tokens.color['text-muted'], fontSize: 15, textAlign: 'center'},
});
