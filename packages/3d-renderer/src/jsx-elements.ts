// Exposes three/webgpu's full catalogue (node materials, instanced meshes, lights, …) as
// R3F JSX elements for the whole package. Type-only augmentation; the runtime counterpart
// is `extend(THREE)` in each canvas host.
import type { ThreeToJSXElements } from '@react-three/fiber'
import type * as THREE from 'three/webgpu'

declare module '@react-three/fiber' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}
