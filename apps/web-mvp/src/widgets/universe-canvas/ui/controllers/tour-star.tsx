import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { type MutableRefObject } from 'react'
import { getTourStarTarget, publishTourStarRect } from '@/shared/lib'
import { VALUES } from '@/shared/config'
import { useMemoryStore } from '@/entities/memory'
import { readBufferPosition } from '../../model/layout-position'

// 첫 별 튜토리얼 캔버스 별 투영기(change 34·job 50) — 페이지가 가리킨 별(getTourStarTarget)의 live
// force-sim 좌표를 매 프레임 화면 rect로 투영해 shared 레지스트리에 싣는다. demo-tour overlay가 그 rect로
// spotlight를 그린다. 씬 안에 DOM(<Html>)을 넣지 않는다(헌법8) — page/ui 레이어가 3D 좌표를 화면으로 투영해
// target을 준다(A7·A8). target이 없을 땐 아무 일도 안 한다(투영·publish 생략).
const v = new THREE.Vector3()

export function TourStarProjector({
  positionsRef,
}: {
  positionsRef: MutableRefObject<Float32Array | null>
}) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  useFrame(() => {
    const id = getTourStarTarget()
    if (!id) return // 가리키는 별이 없으면 publish하지 않는다(레지스트리는 setTourStarTarget이 null로 비운다)
    const stars = useMemoryStore.getState().stars
    const index = stars.findIndex((s) => s.id === id)
    if (index < 0) {
      publishTourStarRect(null) // 아직 안 실린 별(refetch 대기) — rect 없음
      return
    }
    const [x, y, z] = readBufferPosition(positionsRef.current, index, stars.length, stars[index].memory.seed)
    v.set(x, y, z).project(camera)
    // 화면 밖(카메라 뒤 z>1, 또는 viewport 밖 NDC |x|/|y|>1)이면 rect를 비운다 — 안 그러면 overlay가
    // 화면 밖에 구멍을 뚫고 보이는 캔버스를 클릭 차단 패널로 덮어, lock 중 별을 누를 수 없게 된다(A9).
    if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) {
      publishTourStarRect(null)
      return
    }
    const el = gl.domElement
    const r = el.getBoundingClientRect()
    const sx = r.left + (v.x * 0.5 + 0.5) * r.width
    const sy = r.top + (-v.y * 0.5 + 0.5) * r.height
    // 캔버스 별엔 화면 크기가 없으니(멀면 점) 최소 변(values)으로 누를 수 있는 정사각 히트 영역을 친다.
    const side = VALUES.tutorial.starRectMinPx
    publishTourStarRect({ left: sx - side / 2, top: sy - side / 2, width: side, height: side })
  })

  return null
}
