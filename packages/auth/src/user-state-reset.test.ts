import { describe, expect, it } from 'vitest'

import { createCompletionScope } from './completion-scope.ts'
import { resetUserState } from './user-state-reset.ts'

describe('resetUserState', () => {
  it('runs the product legs in order, then the one platform leg', () => {
    const order: string[] = []
    const leg = (name: string) => ({
      name,
      reset: (nextScopeKey: string) => order.push(`${name}:${nextScopeKey}`),
    })

    resetUserState('new-user', leg('locale'), [leg('universe'), leg('signup-completion')])

    expect(order).toEqual(['universe:new-user', 'signup-completion:new-user', 'locale:new-user'])
  })

  it('fences in-flight completions before any leg runs, whatever legs the app registers', () => {
    const scope = createCompletionScope()
    const current = scope.capture()
    const fencedAtFirstLeg: boolean[] = []

    resetUserState('next-user', { name: 'locale', reset: () => {} }, [
      { name: 'product', reset: () => fencedAtFirstLeg.push(!current()) },
    ])
    expect(fencedAtFirstLeg).toEqual([true])

    const later = scope.capture()
    resetUserState('another-user', { name: 'locale', reset: () => {} })
    expect(later()).toBe(false)
  })
})
