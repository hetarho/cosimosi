// 형태 시드 결정론 단위 테스트(spec 53). 순수 model — three/DOM 미의존.
import { describe, expect, it } from 'vitest'
import { seedComponents, seedFromId } from './seed'
import { reshapedSeed, reshapedShapeSeed } from './reshape'

describe('seedComponents — 형태 고유성 3축 시드', () => {
  it('결정론 — 같은 id면 항상 같은 3축(세션·기기 무관, Math.random 비사용, A3)', () => {
    expect(seedComponents('mem-abc')).toEqual(seedComponents('mem-abc'))
  })

  it('축 0 = seedFromId(id) — 기존 wobble/fibonacci/surface 무늬 불변(회귀 경계 A5)', () => {
    expect(seedComponents('mem-abc')[0]).toBe(seedFromId('mem-abc'))
  })

  it('세 축은 서로 다르고 모두 [0,1) — 변위·비대칭이 별마다 다른 실루엣을 만든다(A1)', () => {
    const [a, b, c] = seedComponents('mem-abc')
    expect(a).not.toBe(b)
    expect(b).not.toBe(c)
    expect(a).not.toBe(c)
    for (const v of [a, b, c]) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('다른 id는 다른 3축(별마다 고유 형태)', () => {
    expect(seedComponents('mem-1')).not.toEqual(seedComponents('mem-2'))
  })
})

describe('reshapedShapeSeed — 회상/요지 누적 jitter(A4)', () => {
  it('delta 0이면 무변형(기존 별과 동일)', () => {
    expect(reshapedShapeSeed([0.1, 0.2, 0.3], 0)).toEqual([0.1, 0.2, 0.3])
  })

  it('각 축에 같은 delta를 더한다 — 형태가 미세하게 다시 빚어진다(스칼라 reshapedSeed와 정합)', () => {
    const d = 0.15
    expect(reshapedShapeSeed([0.1, 0.2, 0.3], d)).toEqual([
      reshapedSeed(0.1, d),
      reshapedSeed(0.2, d),
      reshapedSeed(0.3, d),
    ])
  })
})
