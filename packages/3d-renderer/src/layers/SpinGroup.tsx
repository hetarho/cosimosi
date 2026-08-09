import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three/webgpu'

export interface SpinGroupProps {
  /** Seconds per full turn. */
  readonly periodSeconds: number
  /** Holds the current angle instead of advancing it — the reduced-motion setting's one lever. */
  readonly paused?: boolean
  readonly children: ReactNode
}

/**
 * A group that turns its contents about the vertical axis at a fixed rate.
 *
 * It exists for the surfaces that show ONE body away from the universe — a preview, a bench — where
 * a still frame flattens a shape that is not flat. The rotation is a display device, not a fact
 * about the thing shown: nothing reads the angle back, so pausing it changes only what the eye gets.
 *
 * The angle advances by mutating the object3D per frame rather than through React state, which is
 * how every per-frame value in this package moves (§3.2/§3.3).
 */
export function SpinGroup({ periodSeconds, paused = false, children }: SpinGroupProps) {
  const group = useRef<Group>(null)

  useFrame((_, delta) => {
    if (paused) return
    const node = group.current
    if (!node) return
    // Wrapped rather than left to grow, so a surface left open for hours keeps the same float
    // precision on its angle as one just opened.
    node.rotation.y = (node.rotation.y + (Math.PI * 2 * delta) / periodSeconds) % (Math.PI * 2)
  })

  return <group ref={group}>{children}</group>
}
