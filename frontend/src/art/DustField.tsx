import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

type Props = {
  count?: number
  color: string
  speed?: number
  radius?: number
}

export function DustField({ count = 1500, color, speed = 0.2, radius = 6 }: Props) {
  const ref = useRef<THREE.Points>(null!)

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = radius * Math.cbrt(Math.random())
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [count, radius])

  useFrame((_, dt) => {
    ref.current.rotation.y += dt * speed * 0.1
    ref.current.rotation.x += dt * speed * 0.04
  })

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent
        depthWrite={false}
        color={color}
        size={0.035}
        sizeAttenuation
        opacity={0.85}
      />
    </Points>
  )
}
