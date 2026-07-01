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
    camera: {fov: 55},
    bloom: {strength: 1, radius: 0.5, threshold: 0.2},
  },
  skinKey: 'aurora',
  setSkinKey: () => {},
});
export const resolveActiveSkin = (key: string) => key;
