import type { Object3D } from 'three'

// Visual bodies reach the renderer through this port (ARCHITECTURE §3.4) so the
// domain/mirror layer never imports three. Concrete sources (shader | glTF | primitive)
// are injected at the composition boundary; the domain asks for a body by id+kind and
// gets an Object3D back, never a renderer type.
export type VisualBodyKind = 'shader' | 'gltf' | 'primitive'

export interface VisualBodyRequest {
  readonly kind: VisualBodyKind
  readonly id: string
}

export interface VisualBodySource {
  resolve(request: VisualBodyRequest): Object3D | Promise<Object3D>
}
