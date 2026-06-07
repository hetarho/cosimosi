// 공유 StarCanvas 안에 박히는 별 하나. 논리 좌표 (x,y,r)로 위치/크기를 지정하면(부모 박스 기준,
// y-down) 월드 좌표로 변환해 배치한다. concept별로 완전히 다른 오브제(materials.ts)로 그려지고,
// halo는 자전하지 않으며 별 코어만 천천히 돈다. brightness/active 변화는 demand 모드에서도 보이도록
// invalidate로 한 프레임을 깨운다.
import { useContext, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import type { Group } from 'three'
import type { LandingThemeId } from '../../model/theme'
import { buildThemedStar } from './materials'
import { StarCanvasContext } from './star-canvas-context'

export interface Star3DProps {
  concept: LandingThemeId
  /** mood hex(의미색). */
  color: string
  /** 논리 좌표(부모 StarCanvas의 width/height 단위, y-down). */
  x: number
  y: number
  /** 논리 반지름. */
  r: number
  seed?: number
  brightness?: number
  active?: boolean
}

export function Star3D({ concept, color, x, y, r, seed = 1, brightness = 1, active = false }: Star3DProps) {
  const { width, height } = useContext(StarCanvasContext)
  const reduced = !!useReducedMotion()
  const invalidate = useThree((s) => s.invalidate)
  const outerRef = useRef<Group>(null)
  const spinRef = useRef<Group>(null)
  const inited = useRef(false)

  const build = useMemo(
    () => buildThemedStar(concept, color, seed, brightness),
    [concept, color, seed, brightness],
  )
  useEffect(() => () => build.dispose(), [build])

  // demand 모드(정적/reduced)에서도 상호작용·위치 변화가 반영되도록 한 프레임 요청.
  useEffect(() => invalidate(), [brightness, active, concept, x, y, invalidate])

  // 논리 좌표(y-down) → 월드 좌표(중심 원점, y-up).
  const wx = x - width / 2
  const wy = height / 2 - y

  useFrame((state) => {
    const t = reduced ? 0 : state.clock.elapsedTime
    build.update(t, brightness * (active ? 1.3 : 1))
    // 위치: 부드럽게 따라가기(단계 이동·슬라이더). reduced/첫 프레임은 스냅.
    const outer = outerRef.current
    if (outer) {
      if (reduced || !inited.current) {
        outer.position.set(wx, wy, 0)
        inited.current = true
      } else {
        outer.position.x += (wx - outer.position.x) * 0.18
        outer.position.y += (wy - outer.position.y) * 0.18
      }
    }
    const g = spinRef.current
    if (g && !reduced) g.rotation.y = t * build.spin
  })

  return (
    <group ref={outerRef}>
      {/* 글로우 헤일로 — 별 뒤, 자전 안 함 */}
      <mesh geometry={build.halo.geometry} material={build.halo.material} position={[0, 0, -0.5]} scale={r * 3.4} />
      {/* 별 코어 — 테마별 형태/기법, 천천히 자전 */}
      <group ref={spinRef}>
        <mesh geometry={build.star.geometry} material={build.star.material} scale={r} />
      </group>
    </group>
  )
}
