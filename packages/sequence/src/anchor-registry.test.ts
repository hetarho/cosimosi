import { readFileSync } from 'node:fs'

import { afterEach, describe, expect, it } from 'vitest'

import { measureAnchor, useSequenceAnchorRegistry } from './anchor-registry.ts'
import { resetSequenceUserState } from './user-state-reset.ts'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
}

afterEach(() => {
  resetSequenceUserState()
})

describe('anchor registry', () => {
  it('hands back the rect of a registered control', async () => {
    const rect = { x: 10, y: 20, width: 30, height: 40 }
    useSequenceAnchorRegistry.getState().register('write', { measure: async () => rect })
    await expect(measureAnchor('write')).resolves.toEqual(rect)
  })

  it('degrades to no rect rather than an error when an anchor cannot be resolved', async () => {
    // Three ways an anchor fails, one outcome: the caption and the skip stay, the step still advances
    // on its signal, and the run stays completable. There is deliberately no timeout and no retry.
    await expect(measureAnchor(undefined)).resolves.toBeNull()
    await expect(measureAnchor('never-registered')).resolves.toBeNull()

    useSequenceAnchorRegistry.getState().register('broken', {
      measure: async () => {
        throw new Error('detached from the tree')
      },
    })
    await expect(measureAnchor('broken')).resolves.toBeNull()

    useSequenceAnchorRegistry.getState().register('unmeasurable', { measure: async () => null })
    await expect(measureAnchor('unmeasurable')).resolves.toBeNull()
  })

  it('replaces the map rather than mutating it, so subscribers re-measure', () => {
    const { register, unregister } = useSequenceAnchorRegistry.getState()
    const before = useSequenceAnchorRegistry.getState().anchors
    register('write', { measure: async () => null })
    const afterRegister = useSequenceAnchorRegistry.getState().anchors
    expect(afterRegister).not.toBe(before)

    unregister('write')
    const afterUnregister = useSequenceAnchorRegistry.getState().anchors
    expect(afterUnregister.has('write')).toBe(false)

    // Unregistering something absent keeps the SAME map, so an unmount race cannot churn every
    // subscriber into a re-measure for nothing.
    unregister('absent')
    expect(useSequenceAnchorRegistry.getState().anchors).toBe(afterUnregister)
  })

  it('is cleared on an account boundary', () => {
    useSequenceAnchorRegistry.getState().register('write', { measure: async () => null })
    resetSequenceUserState()
    expect(useSequenceAnchorRegistry.getState().anchors.size).toBe(0)
  })
})

describe('engine isolation', () => {
  it('declares no dependency that could reach a transport, a fixture or a read mirror', () => {
    // An assertion rather than a review habit: this list is the reason the same engine can run over
    // a real signed-in account. Anything added here has to be defensible against [I13] first.
    expect(Object.keys(manifest.dependencies).sort()).toEqual(['xstate', 'zustand'])
    expect(Object.keys(manifest.peerDependencies).sort()).toEqual(['@xstate/react', 'react'])
  })
})
