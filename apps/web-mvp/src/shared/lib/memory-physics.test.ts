import { describe, expect, it } from 'vitest'
import {
  abstractionStageForRadius,
  connectednessById,
  emotionSimilarity,
  memoryRadiusR,
  starRadius,
} from './memory-physics'

// 데모·실렌더 parity 골든 대조(job 43) — 서버 권위 로직(Go: internal/job/radius.go stageForRadius,
// internal/job/excitability.go emotionSimilarity)의 알려진 출력에 TS 포트를 못 박는다. 서버 식이
// 바뀌면(노브·공식) 이 테스트가 깨져 데모 미러가 드리프트하는 걸 명시적으로 잡는다. 픽스처 값은
// spec/values.yaml(consolidation.gist_stage_radii=[40,55,68,78])에서 직접 계산했다.

describe('abstractionStageForRadius (Go stageForRadius 미러)', () => {
  // 임계 [40,55,68,78]를 넘은 개수 = 단계(0..4). 경계값은 strict > 라 임계 자신은 넘은 게 아니다.
  it('반지름 구간마다 0..4 단계로 단조 증가한다', () => {
    expect(abstractionStageForRadius(0)).toBe(0)
    expect(abstractionStageForRadius(39.9)).toBe(0)
    expect(abstractionStageForRadius(40)).toBe(0) // 경계: > 아님
    expect(abstractionStageForRadius(40.1)).toBe(1)
    expect(abstractionStageForRadius(55)).toBe(1)
    expect(abstractionStageForRadius(55.1)).toBe(2)
    expect(abstractionStageForRadius(68.1)).toBe(3)
    expect(abstractionStageForRadius(78.1)).toBe(4)
    expect(abstractionStageForRadius(1000)).toBe(4) // 상한 = 임계 개수
  })

  it('반지름이 커질수록 단계가 줄지 않는다(단조)', () => {
    let prev = -1
    for (let r = 0; r <= 90; r += 3) {
      const s = abstractionStageForRadius(r)
      expect(s).toBeGreaterThanOrEqual(prev)
      prev = s
    }
  })
})

describe('emotionSimilarity (Go emotionSimilarity 미러)', () => {
  it('같은 정동이면 1, 정반대(√5 거리)면 0', () => {
    expect(emotionSimilarity(0.5, 0.5, 0.5, 0.5)).toBeCloseTo(1, 6)
    expect(emotionSimilarity(-1, 1, 1, 0)).toBeCloseTo(0, 6) // hypot(2,1)=√5 = EMO_MAX_DIST
  })
  it('거리가 멀수록 유사도가 줄고 [0,1]에 갇힌다', () => {
    const near = emotionSimilarity(0.6, 0.5, 0.5, 0.5)
    const far = emotionSimilarity(0.6, 0.5, -0.6, 0.9)
    expect(near).toBeGreaterThan(far)
    expect(far).toBeGreaterThanOrEqual(0)
    expect(near).toBeLessThanOrEqual(1)
  })
})

describe('starRadius / memoryRadiusR (거리=강함)', () => {
  const NOW = 1_700_000_000_000
  const DAY = 86_400_000
  it('최근 회상일수록 반지름이 작다(강하다)', () => {
    const recent = starRadius(3, 0.7, NOW - 1 * DAY, NOW, 1)
    const old = starRadius(3, 0.7, NOW - 120 * DAY, NOW, 1)
    expect(recent).toBeLessThan(old)
  })
  it('연결성이 높을수록 감쇠가 느려 반지름이 작다(중앙으로 당김, 밖으로 밀지 않음)', () => {
    const connected = memoryRadiusR(2, 0.5, NOW - 60 * DAY, NOW, 2)
    const isolated = memoryRadiusR(2, 0.5, NOW - 60 * DAY, NOW, 0)
    expect(connected).toBeGreaterThan(isolated) // 연결 → R↑ → 반지름↓
  })
})

describe('connectednessById (median 정규화)', () => {
  it('허브는 보통 별보다 연결성이 높고, 간선 없는 별은 맵에 없다(0으로 읽힘)', () => {
    const edges = [
      { aId: 'a', bId: 'b', weight: 0.5 },
      { aId: 'a', bId: 'c', weight: 0.5 },
      { aId: 'a', bId: 'd', weight: 0.5 },
      { aId: 'b', bId: 'c', weight: 0.5 },
    ]
    const conn = connectednessById(edges)
    expect(conn.get('a') ?? 0).toBeGreaterThan(conn.get('d') ?? 0) // a=허브(degree 3) > d(degree 1)
    expect(conn.has('e')).toBe(false) // 간선 없는 별은 부재
  })
})
