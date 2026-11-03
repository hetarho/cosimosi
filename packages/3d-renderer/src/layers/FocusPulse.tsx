import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, Mesh, MeshBasicNodeMaterial, RingGeometry } from 'three/webgpu'

import type { CoordinateBufferRef } from './InstancedNodeLayer.tsx'
import { advanceFocusPulse, createFocusPulse } from './focus-pulse.ts'

/** A transient neutral annotation following a live coordinate slot, separate from body channels. */
export function FocusPulse({
  positions,
  nodeIndex,
  radius,
  reducedMotion,
  onComplete,
}: {
  readonly positions: CoordinateBufferRef
  readonly nodeIndex: number
  readonly radius: number
  readonly reducedMotion: boolean
  readonly onComplete: () => void
}) {
  const mesh = useRef<Mesh>(null)
  const pulse = useRef(createFocusPulse())
  const geometry = useMemo(() => new RingGeometry(1, 1.045, 96), [])
  const material = useMemo(
    () =>
      new MeshBasicNodeMaterial({
        color: 0xe6dcff,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        depthTest: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    [],
  )
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  useFrame(({ camera }, delta) => {
    if (pulse.current.completed) return
    const done = advanceFocusPulse(pulse.current, delta, reducedMotion)
    const buffer = positions.current
    const offset = nodeIndex * 3
    const ring = mesh.current
    if (ring) {
      ring.visible = !!buffer && offset >= 0 && offset + 2 < buffer.length
      if (buffer && ring.visible) {
        ring.position.set(buffer[offset]!, buffer[offset + 1]!, buffer[offset + 2]!)
        ring.quaternion.copy(camera.quaternion)
        ring.scale.setScalar(radius * pulse.current.scale)
        material.opacity = pulse.current.opacity
      }
    }
    if (done) onComplete()
  })
  return <mesh ref={mesh} geometry={geometry} material={material} renderOrder={10} dispose={null} />
}
