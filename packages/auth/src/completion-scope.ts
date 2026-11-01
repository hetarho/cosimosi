let userScopeGeneration = 0

/** Invalidates work before account-owned stores are cleared. */
export function invalidateUserScope(): void {
  userScopeGeneration += 1
}

/** A completion belongs to both its account and its mounted owner. */
export function createCompletionScope() {
  let ownerGeneration = 0
  let active = true
  return {
    activate() {
      active = true
      ownerGeneration += 1
    },
    invalidate() {
      active = false
      ownerGeneration += 1
    },
    capture(): () => boolean {
      const account = userScopeGeneration
      const owner = ownerGeneration
      return () => active && account === userScopeGeneration && owner === ownerGeneration
    },
  }
}
