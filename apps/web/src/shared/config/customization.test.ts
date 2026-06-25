// 커스터마이즈 경제 헬퍼 — 선택의 sub-item 분해(별=단일 룩 change 29, 나·시냅스=form·surface spec 52) + 무료/소유 판정.
import { describe, expect, it } from 'vitest'
import { itemId, subItemIds, isFree, isOwned, priceOf } from './customization'

describe('customization — sub-item 분해', () => {
  it('배경·별은 단일 id, 나·시냅스는 form·surface 2 sub-item', () => {
    expect(subItemIds('background', 'galaxy')).toEqual(['background:galaxy'])
    expect(subItemIds('star', 'polyhedron')).toEqual(['star:look:polyhedron'])
    expect(subItemIds('star', 'spiky')).toEqual(['star:look:spiky'])
    expect(subItemIds('self', 'orb+mirror')).toEqual(['self:form:orb', 'self:surface:mirror'])
    expect(subItemIds('synapse', 'strands+flow')).toEqual(['synapse:form:strands', 'synapse:surface:flow'])
  })

  it('무료 룩/프리셋 sub-item은 묵시 소유(무료)', () => {
    expect(isFree('star:look:polyhedron')).toBe(true)
    expect(isFree('background:galaxy')).toBe(true)
    expect(isFree('star:look:liquid')).toBe(false)
    expect(isFree('star:look:spiky')).toBe(false)
  })

  it('별 룩 선택의 소유 = 그 룩 sub-item 소유(또는 무료)', () => {
    const owned = new Set<string>(['star:look:spiky'])
    expect(subItemIds('star', 'liquid').every((id) => isOwned(id, owned))).toBe(false) // 미소유 유료
    expect(subItemIds('star', 'spiky').every((id) => isOwned(id, owned))).toBe(true) // 소유 유료
    expect(subItemIds('star', 'polyhedron').every((id) => isOwned(id, owned))).toBe(true) // 무료
  })

  it('유료 sub-item 가격은 itemId 규약과 일치한다', () => {
    expect(priceOf(itemId('star', 'look:liquid'))).toBe(priceOf('star:look:liquid'))
    expect(typeof priceOf('self:surface:neuron')).toBe('number')
  })
})
