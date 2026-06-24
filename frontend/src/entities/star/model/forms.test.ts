// 별 형태(룩) 단일 축 모델 단위 테스트(change 29). 순수 model — three/DOM 미의존.
import { describe, expect, it } from 'vitest'
import { VALUES } from '@/shared/config'
import {
  STAR_LOOKS,
  DEFAULT_STAR_LOOK,
  DEFAULT_STAR_SELECTION,
  parseStarLook,
  normalizeStarLook,
} from './forms'

describe('star looks — 단일 축 형태(change 29)', () => {
  it('카탈로그 = 3종(polyhedron·liquid·spiky), 기본 = polyhedron', () => {
    expect(STAR_LOOKS.map((l) => l.id)).toEqual(['polyhedron', 'liquid', 'spiky'])
    expect(DEFAULT_STAR_LOOK).toBe('polyhedron')
    expect(DEFAULT_STAR_SELECTION).toBe('polyhedron')
  })

  it('parse는 유효 룩만 통과, 미지/빈/비문자열은 디폴트로 폴백(크래시 없음)', () => {
    expect(parseStarLook('liquid')).toBe('liquid')
    expect(parseStarLook('spiky')).toBe('spiky')
    expect(parseStarLook('nope')).toBe('polyhedron')
    expect(parseStarLook(undefined)).toBe('polyhedron')
    expect(parseStarLook('')).toBe('polyhedron')
    // 레거시 합성 id(form+surface)는 폴백 — 호환 불필요(change 29)
    expect(parseStarLook('lowpoly+facet')).toBe('polyhedron')
  })

  it('normalize는 항상 유효 룩을 돌려준다', () => {
    expect(normalizeStarLook('spiky')).toBe('spiky')
    expect(normalizeStarLook('garbage')).toBe(DEFAULT_STAR_LOOK)
  })

  it('values 정합 — 무료 별 슬롯이 카탈로그 기본과 같다', () => {
    const free = VALUES.customization.free as Record<string, string>
    expect(free['star:look']).toBe(DEFAULT_STAR_LOOK)
  })

  it('values 정합 — 유료 star:look 가격 키가 실제 카탈로그 룩을 가리킨다', () => {
    const price = VALUES.customization.price as Record<string, number>
    const lookIds = new Set<string>(STAR_LOOKS.map((l) => l.id))
    for (const key of Object.keys(price)) {
      if (key.startsWith('star:look:')) expect(lookIds.has(key.slice('star:look:'.length))).toBe(true)
    }
  })
})
