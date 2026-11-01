import { describe, expect, it } from 'vitest'

import { createCompletionScope, invalidateUserScope } from './completion-scope.ts'

describe('completion ownership', () => {
  it('rejects account A completions after reset even if the owner remains mounted', () => {
    const scope = createCompletionScope()
    const isCurrent = scope.capture()
    invalidateUserScope()
    expect(isCurrent()).toBe(false)
    expect(scope.capture()()).toBe(true)
  })

  it('rejects unmounted work and never revives it on effect replay', () => {
    const scope = createCompletionScope()
    const first = scope.capture()
    scope.invalidate()
    expect(first()).toBe(false)
    scope.activate()
    expect(first()).toBe(false)
    expect(scope.capture()()).toBe(true)
  })
})
