import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshDistortMaterial, Sphere } from '@react-three/drei'
import type { Mesh } from 'three'

type Props = {
  color: string
  position?: [number, number, number]
  scale?: number
  distortSpeed?: number
}

export function MoodOrb({ color, position = [0, 0, 0], scale = 1, distortSpeed = 1.2 }: Props) {
  const ref = useRef<Mesh>(null!)
  useFrame((_, dt) => {
    ref.current.rotation.y += dt * 0.15
    ref.current.rotation.x += dt * 0.05
  })

  return (
    <Sphere ref={ref} args={[1, 64, 64]} position={position} scale={scale}>
      <MeshDistortMaterial
        color={color}
        roughness={0.2}
        metalness={0.1}
        emissive={color}
        emissiveIntensity={0.4}
        distort={0.45}
        speed={distortSpeed}
      />
    </Sphere>
  )
}
