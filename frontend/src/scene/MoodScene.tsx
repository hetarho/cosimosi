import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { useMoodStore } from '../store/mood'
import { MoodOrb } from '../art/MoodOrb'
import { DustField } from '../art/DustField'
import { Ribbon } from '../art/Ribbon'

export function MoodScene() {
  const mood = useMoodStore((s) => s.mood)
  const palette = useMoodStore((s) => s.palette())

  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 55 }} dpr={[1, 2]}>
      <color attach="background" args={['#050510']} />
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color={palette.accent} />
      <pointLight position={[-5, -3, 4]} intensity={0.8} color={palette.secondary} />

      <MoodOrb color={palette.primary} scale={1.4} distortSpeed={palette.particleSpeed * 3 + 0.4} />
      <Ribbon color={palette.secondary} position={[2.4, 1.2, -1]} scale={0.6} speed={palette.particleSpeed} />
      <Ribbon color={palette.accent} position={[-2.6, -1.0, -0.5]} scale={0.5} speed={palette.particleSpeed * 0.7} />
      <DustField color={palette.accent} speed={palette.particleSpeed} />

      <Environment preset={mood === 'storm' ? 'night' : 'sunset'} />

      <EffectComposer>
        <Bloom intensity={palette.bloomIntensity} luminanceThreshold={0.15} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.8} />
      </EffectComposer>

      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.4} />
    </Canvas>
  )
}
