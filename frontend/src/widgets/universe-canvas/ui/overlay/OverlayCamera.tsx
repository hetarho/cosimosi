// Overlay camera (spec 37): a free orbit around BOTH skies + a "frame the pair" flight. When a
// resonance bridge is clicked the navigation machine enters overlay.framingPair (FRAME_PAIR); this
// controller resolves the two stars' WORLD coords (each from its own universe's live buffer +
// offset), lerps the camera to a vantage that holds both on screen, then sends ARRIVED. Mirrors the
// single-universe FrameAll flight feel (k = 1−exp(−dt·4), yields on leaving the state). Free orbit
// (drei OrbitControls) owns the camera in overlay.viewing.
import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useSelector } from '@xstate/react'
import * as THREE from 'three'
import { navigationActor, selectFramingPair } from '../../model/navigation.machine'
import type { OverlayHandle } from './types'

const MIN_FRAME_DIST = 40
const SEP_MARGIN = 1.4 // vantage distance ≈ separation·margin + pad, so both stars fit comfortably
const FRAME_PAD = 26
// 쌍 프레이밍 비행 중엔 거리 클램프를 푼다(단일 우주 CameraRig가 transitioning에서 하는 것과 동형):
// 근접 쌍은 목표 거리가 minDistance(40)에 딱 걸려, 매 프레임 controls.update()의 재클램프가 도착
// 판정(distanceTo<0.5)을 흔들어 비행이 지터/지연된다. 비행 동안 풀고 도착(viewing)하면 다시 조인다.
const FLY_MIN_DIST = 0.01
const FLY_MAX_DIST = 100_000

export interface OverlayCameraProps {
  mineRef: MutableRefObject<OverlayHandle | null>
  theirsRef: MutableRefObject<OverlayHandle | null>
}

export function OverlayCamera({ mineRef, theirsRef }: OverlayCameraProps) {
  const framing = useSelector(navigationActor, selectFramingPair)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null
  const lastSeqRef = useRef(0)
  const posRef = useRef<THREE.Vector3 | null>(null)
  const tgtRef = useRef<THREE.Vector3 | null>(null)
  const A = useMemo(() => new THREE.Vector3(), [])
  const B = useMemo(() => new THREE.Vector3(), [])

  const worldOf = (handle: OverlayHandle | null, id: string, out: THREE.Vector3): boolean => {
    if (!handle) return false
    const row = handle.idIndex.get(id)
    const buf = handle.positionsRef.current
    if (row == null || !buf || buf.length < (row + 1) * 3) return false
    out.set(
      buf[row * 3] + handle.offset[0],
      buf[row * 3 + 1] + handle.offset[1],
      buf[row * 3 + 2] + handle.offset[2],
    )
    return true
  }

  useFrame((_, dt) => {
    // New FRAME_PAIR request (seq changed) → capture a vantage framing both world endpoints. Done in
    // useFrame (not render) so refs are read off-render, and so the endpoints are resolved from the
    // LIVE sim buffers (which may not be ready the instant the click lands).
    if (framing && framing.seq !== lastSeqRef.current) {
      const okA = worldOf(mineRef.current, framing.myId, A)
      const okB = worldOf(theirsRef.current, framing.theirId, B)
      if (okA && okB) {
        lastSeqRef.current = framing.seq
        const center = A.clone().add(B).multiplyScalar(0.5)
        const sep = A.distanceTo(B)
        const dist = Math.max(MIN_FRAME_DIST, sep * SEP_MARGIN + FRAME_PAD)
        // Keep the current viewing direction (a swing, not a surprise); degenerate → +Z.
        const dir = camera.position.clone().sub(controls ? controls.target : center)
        if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1)
        dir.normalize()
        camera.up.set(0, 1, 0)
        posRef.current = center.clone().addScaledVector(dir, dist)
        tgtRef.current = center
      }
    }

    const pos = posRef.current
    const tgt = tgtRef.current
    if (!pos || !tgt) return
    // Yield if a later transition leaves framingPair (e.g. EXIT_OVERLAY) — no fighting the orbit.
    if (!navigationActor.getSnapshot().matches({ overlay: 'framingPair' })) {
      posRef.current = null
      tgtRef.current = null
      return
    }
    const k = 1 - Math.exp(-dt * 4)
    camera.position.lerp(pos, k)
    if (controls) {
      controls.target.lerp(tgt, k)
      controls.update()
    } else {
      camera.lookAt(tgt)
    }
    if (camera.position.distanceTo(pos) < 0.5) {
      camera.position.copy(pos)
      if (controls) {
        controls.target.copy(tgt)
        controls.update()
      }
      posRef.current = null
      tgtRef.current = null
      navigationActor.send({ type: 'ARRIVED' }) // framingPair → viewing (free orbit resumes)
    }
  })

  // framingPair 비행 중(framing 비null)엔 클램프를 풀어 근접 쌍에서도 카메라가 목표 시점에 안착한다.
  const flying = framing != null
  return (
    <OrbitControls
      makeDefault
      enableDamping
      enablePan={false}
      minDistance={flying ? FLY_MIN_DIST : MIN_FRAME_DIST}
      maxDistance={flying ? FLY_MAX_DIST : 2000}
    />
  )
}
