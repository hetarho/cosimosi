import { describe, expect, it } from 'vitest'
import { createSim, tick, isSettled } from './sim'
import type { SimEdge, SimGraph, SimNode } from './types'

// 안정성 회귀(spec 07): 강한 스프링(intra_entry급 weight 0.8)이 촘촘한 밀집 그래프에서도
// explicit-Euler 적분이 폭주하지 않아야 한다. 클램프 이전엔 좌표가 수만~무한대로 발산해
// octree half=Infinity → 무한 재귀(스택 오버플로)로 이어졌다(다조각 페르소나 우주에서 재현됨).
// 합성 그래프로 force-sim만 독립 검증한다(demo 비의존).
//
// 구조: N개 군집(각 2~3개 노드가 weight 0.8로 완전 연결 = 강한 결속) + 군집 간 약한 교차 링크.
// 초기 배치는 피보나치 셸(첫 로드 근사). 노드는 모두 free(첫 로드).
function denseGraph(clusters: number): SimGraph {
  const nodes: SimNode[] = []
  const edges: SimEdge[] = []
  const ids: string[] = []
  let idx = 0
  for (let c = 0; c < clusters; c++) {
    const size = 2 + (c % 2) // 2 또는 3개 조각
    const members: string[] = []
    for (let m = 0; m < size; m++) {
      const id = `n${idx}`
      ids.push(id)
      members.push(id)
      const t = (idx + 0.5) / (clusters * 3)
      const phi = Math.acos(1 - 2 * t)
      const theta = Math.PI * (1 + Math.sqrt(5)) * idx
      const r = 22 + (idx % 7) * 3
      nodes.push({
        id,
        pinned: false,
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi),
      })
      idx++
    }
    // 군집 내 강한 결속(intra_entry 0.8) — 모든 쌍.
    for (let i = 0; i < members.length; i++)
      for (let k = i + 1; k < members.length; k++)
        edges.push({ source: members[i], target: members[k], weight: 0.8 })
  }
  // 군집 간 의미 교차 링크(각 노드 → 뒤쪽 노드 몇 개, 중간 weight) — 밀도를 높여 stiffness↑.
  for (let i = 0; i < ids.length; i++) {
    for (let d = 1; d <= 4; d++) {
      const j = (i + d * 7) % ids.length
      if (j !== i) edges.push({ source: ids[i], target: ids[j], weight: 0.6 })
    }
  }
  return { nodes, edges }
}

const maxAbs = (buf: Float32Array): number => {
  let m = 0
  for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]))
  return m
}

describe('force-sim stability under dense, strong-spring graphs', () => {
  it('좌표가 끝까지 유한하고 합리적 범위에 머문다(발산 없음)', () => {
    const sim = createSim(denseGraph(28), undefined, { seedNewNodes: false })
    let buf: Float32Array = new Float32Array(0)
    for (let i = 0; i < 400; i++) buf = tick(sim, 2)
    for (let i = 0; i < buf.length; i++) expect(Number.isFinite(buf[i])).toBe(true)
    // 폭주하면 수천~수만으로 튄다 — 클램프된 레이아웃은 군집 스케일(linkDistance 30) 부근.
    expect(maxAbs(buf)).toBeLessThan(1000)
    expect(isSettled(sim)).toBe(true)
  })

  it('비유한 좌표가 섞여도 tick이 크래시하지 않는다(octree 깊이 백스톱)', () => {
    // 한 노드를 일부러 Infinity로 둬 octree bounding half가 Infinity가 되게 한다 — 깊이 cap이
    // 없으면 insert가 무한 재귀(스택 오버플로)한다. 클램프가 다음 틱에 유한으로 되돌린다.
    const g = denseGraph(10)
    g.nodes[0] = { ...g.nodes[0], x: Number.POSITIVE_INFINITY }
    const sim = createSim(g, undefined, { seedNewNodes: false })
    expect(() => tick(sim, 4)).not.toThrow()
  })
})
