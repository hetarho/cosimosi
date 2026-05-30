import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'

type Props = {
  color: string
  position?: [number, number, number]
  scale?: number
  speed?: number
}

export function Ribbon({ color, position = [0, 0, 0], scale = 1, speed = 0.4 }: Props) {
  const ref = useRef<Mesh>(null!)
  useFrame((_, dt) => {
    ref.current.rotation.x += dt * speed
    ref.current.rotation.z += dt * speed * 0.6
  })

  return (
    <mesh ref={ref} position={position} scale={scale}>
      <torusKnotGeometry args={[1.4, 0.18, 256, 32, 2, 5]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
        roughness={0.3}
        metalness={0.4}
      />
    </mesh>
  )
}
