import { useFrame } from '@react-three/fiber'

// Shared R3F layer: hands the frame delta to a plain callback so consumers outside the
// three boundary (e.g. a worker bridge pump) can run per-frame work without importing
// R3F. The callback must not set React state or read a store per frame (§3.2).
export function FrameTick({ onFrame }: { readonly onFrame: (dt: number) => void }) {
  useFrame((_, delta) => onFrame(delta))
  return null
}
