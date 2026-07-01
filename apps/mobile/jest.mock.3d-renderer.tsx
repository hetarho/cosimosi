// Jest mock for @cosimosi/3d-renderer. The shell smoke tests run in Node and exercise
// the shell, not the WebGPU renderer; the real package pulls in three (ESM) which the
// host jest env doesn't transform. Stub the surface the nav tree imports.
import * as React from 'react';

const Passthrough = ({children}: {children?: React.ReactNode}) =>
  React.createElement(React.Fragment, null, children);
const Noop = () => null;

export const UniverseCanvas = Passthrough;
export const SkinProvider = Passthrough;
export const UniverseScene = Noop;
export const Background = Noop;
export const StarField = Noop;
export const PostFX = Noop;
export const useSkin = () => ({
  skin: {
    key: 'aurora',
    label: 'Aurora',
    background: {
      type: 'nebula',
      props: {
        clear: [0.01, 0.02, 0.05],
        palette: [0x070a1a, 0x1b2a6b, 0x2f8f9d],
        pattern: {warp: 0.55, freq: 1.6, detail: 1.4},
      },
    },
    camera: {fov: 55},
    bloom: {strength: 1, radius: 0.5, threshold: 0.2},
  },
  skinKey: 'aurora',
  setSkinKey: () => {},
});
export const resolveActiveSkin = (key: string) => key;
