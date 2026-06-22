// 커스터마이즈 경제 헬퍼 — 합성 선택의 sub-item 분해(spec 52) + 무료/소유 판정.
import { describe, expect, it } from 'vitest'
import { itemId, subItemIds, isFree, isOwned, priceOf } from './customization'

describe('customization — sub-item 분해(spec 52)', () => {
  it('배경은 단일 id, 형태 3축은 form·surface 2 sub-item', () => {
    expect(subItemIds('background', 'galaxy')).toEqual(['background:galaxy'])
    expect(subItemIds('star', 'lowpoly+facet')).toEqual(['star:form:lowpoly', 'star:surface:facet'])
    expect(subItemIds('self', 'orb+mirror')).toEqual(['self:form:orb', 'self:surface:mirror'])
    expect(subItemIds('synapse', 'strands+flow')).toEqual(['synapse:form:strands', 'synapse:surface:flow'])
  })

  it('무료 프리셋 sub-item은 묵시 소유(무료)', () => {
    expect(isFree('star:form:lowpoly')).toBe(true)
    expect(isFree('star:surface:facet')).toBe(true)
    expect(isFree('background:galaxy')).toBe(true)
    expect(isFree('star:form:liquid')).toBe(false)
  })

  it('합성 선택의 소유 = 양쪽 sub-item 소유(또는 무료)', () => {
    const owned = new Set<string>(['star:surface:lava'])
    // octa(유료·미소유) + lava(유료·소유) → 한쪽 미소유라 합성 미소유
    const ids = subItemIds('star', 'octa+lava')
    expect(ids.every((id) => isOwned(id, owned))).toBe(false)
    // lowpoly(무료) + lava(소유) → 합성 소유
    expect(subItemIds('star', 'lowpoly+lava').every((id) => isOwned(id, owned))).toBe(true)
  })

  it('유료 sub-item 가격은 itemId 규약과 일치한다', () => {
    expect(priceOf(itemId('star', 'form:liquid'))).toBe(priceOf('star:form:liquid'))
    expect(typeof priceOf('self:surface:neuron')).toBe('number')
  })
})
