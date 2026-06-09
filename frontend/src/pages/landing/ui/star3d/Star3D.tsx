// 공유 StarCanvas 안에 박히는 별 하나(캔버스 측 합성). 별 몸체·halo는 star 엔티티에서 불러오고
// (buildShowcaseStar / buildHalo), 여기선 그 둘을 각각 mesh로 얹는다 — 별=form, halo=캔버스가
// 입히는 효과. 논리 좌표 (x,y,r)로 위치/크기를 지정하면(부모 박스 기준, y-down) 월드 좌표로 변환해
// 배치한다. halo는 자전하지 않고 별 코어만 천천히 돈다. brightness/active 변화는 demand 모드에서도
// 보이도록 invalidate로 한 프레임을 깨운다.
import { useContext, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import type { Group } from 'three'
import { buildSingleStar, type StarObject } from '@/entities/star'
import { buildHalo } from './halo'
import { StarCanvasContext } from './star-canvas-context'

export interface Star3DProps {
  concept: StarObject
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

  // 별 몸체(form)는 엔티티에서, halo는 랜딩의 글로우 효과 — 캔버스가 둘을 각각 얹는다. 둘 다
  // self-contained(자체 유니폼 + update)라, 매 프레임 같은 밝기로 함께 갱신해 동기로 맥동한다.
  const body = useMemo(() => buildSingleStar(concept, color, seed, brightness), [concept, color, seed, brightness])
  const halo = useMemo(() => buildHalo(color, brightness), [color, brightness])
  useEffect(
    () => () => {
      body.geometry.dispose()
      body.material.dispose()
      halo.geometry.dispose()
      halo.material.dispose()
    },
    [body, halo],
  )

  // demand 모드(정적/reduced)에서도 상호작용·위치 변화가 반영되도록 한 프레임 요청.
  useEffect(() => invalidate(), [brightness, active, concept, x, y, invalidate])

  // 논리 좌표(y-down) → 월드 좌표(중심 원점, y-up).
  const wx = x - width / 2
  const wy = height / 2 - y

  useFrame((state) => {
    const t = reduced ? 0 : state.clock.elapsedTime
    const b = brightness * (active ? 1.3 : 1)
    body.update(t, b)
    halo.update(b)
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
    if (g && !reduced) g.rotation.y = t * body.spin
  })

  return (
    <group ref={outerRef}>
      {/* 글로우 헤일로 — 별 뒤, 자전 안 함. 부모(ThemedStar/카드)가 논리 박스를 별의 ~4배로 잡으면
          이 halo(r*3.4)가 박스 안에 온전히 들어와 카메라가 가장자리를 사각으로 자르지 않는다. */}
      <mesh geometry={halo.geometry} material={halo.material} position={[0, 0, -0.5]} scale={r * 3.4} />
      {/* 별 코어 — 형태별 오브제(star 엔티티), 천천히 자전 */}
      <group ref={spinRef}>
        <mesh geometry={body.geometry} material={body.material} scale={r} />
      </group>
    </group>
  )
}
