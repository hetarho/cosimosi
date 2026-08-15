// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAwakenRegistryStore, useLatentConsumedStore } from '@cosimosi/universe'

vi.mock('@cosimosi/3d-renderer', () => ({
  FrameTick: () => null,
  InstancedNodeLayer: () => null,
  createPrimitiveBodySource: () => ({}),
}))

import { AwakenNeuron } from './AwakenNeuron.tsx'

describe('AwakenNeuron claim lifecycle', () => {
  beforeEach(() => {
    useAwakenRegistryStore.getState().reset()
    useLatentConsumedStore.getState().reset()
  })

  it('claims a short-field batch once so exhausted births do not retry forever', () => {
    render(
      <AwakenNeuron
        field={{ positions: new Float32Array([1, 2, 3]), count: 1 }}
        newNeuronIds={['neuron-a', 'neuron-b']}
        resolveAnchors={() => []}
      />,
    )

    expect([...useLatentConsumedStore.getState().consumed]).toEqual([0])
    expect([...useAwakenRegistryStore.getState().claimed]).toEqual(['neuron-a', 'neuron-b'])
  })

  it('claims the attempted batch when the field is already exhausted', () => {
    render(
      <AwakenNeuron
        field={{ positions: new Float32Array(), count: 0 }}
        newNeuronIds={['neuron-a']}
        resolveAnchors={() => []}
      />,
    )

    expect(useLatentConsumedStore.getState().consumed.size).toBe(0)
    expect([...useAwakenRegistryStore.getState().claimed]).toEqual(['neuron-a'])
  })
})
