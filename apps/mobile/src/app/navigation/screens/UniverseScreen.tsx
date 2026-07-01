import {StyleSheet, Text, View} from 'react-native';

import {Button, tokens} from '@cosimosi/ui';
import {m} from '@cosimosi/i18n';
import {VALUES} from '@cosimosi/config';
import {
  ObservedErrorBoundary,
  type ObservedErrorBoundaryFallbackProps,
} from '@cosimosi/observability/react';
import {SkinProvider, UniverseCanvas, UniverseScene, resolveActiveSkin, useSkin} from '@cosimosi/3d-renderer';

// The same shared 3D scene as web (@cosimosi/3d-renderer) — skinned background + stars +
// bloom, composed by UniverseScene (rendering vocabulary stays inside the package). Only
// the build setup forks on native (metro three→webgpu + @react-three/fiber→web build,
// react-native-webgpu). Error-boundaried so a WebGPU/native failure shows a fallback.
function SceneHost() {
  const {skin} = useSkin();
  return (
    <UniverseCanvas dpr={[1, VALUES.rendering.maxPixelRatio]} fov={skin.camera.fov}>
      <UniverseScene skin={skin} />
    </UniverseCanvas>
  );
}

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
    <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
      <View style={styles.root}>
        <View style={StyleSheet.absoluteFill}>
          <ObservedErrorBoundary fallback={RendererFallback}>
            <SceneHost />
          </ObservedErrorBoundary>
        </View>
        <View style={styles.hud}>
          <Button>{m.universe_home_write()}</Button>
        </View>
      </View>
    </SkinProvider>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  hud: {position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center'},
  fallback: {flex: 1, gap: 16, alignItems: 'center', justifyContent: 'center', padding: 24},
  fallbackText: {color: tokens.color['text-muted'], fontSize: 15, textAlign: 'center'},
});
