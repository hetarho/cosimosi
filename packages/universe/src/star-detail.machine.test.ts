import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import type { EpisodicMemory, Neuron } from '@cosimosi/memory'

import { gistNodeId, parseGistNodeId } from './gist-star-channels.ts'
import { resolveSelection, starDetailMachine } from './star-detail.machine.ts'

function actor() {
  return createActor(starDetailMachine).start()
}

describe('starDetailMachine', () => {
  it('opens to meta on selection and toggles the provenance view', () => {
    const panel = actor()
    expect(panel.getSnapshot().value).toBe('closed')
    panel.send({ type: 'OPEN' })
    expect(panel.getSnapshot().value).toBe('meta')
    panel.send({ type: 'SHOW_PROVENANCE' })
    expect(panel.getSnapshot().value).toBe('provenance')
    panel.send({ type: 'BACK' })
    expect(panel.getSnapshot().value).toBe('meta')
  })

  it('closes to closed from either view on deselect/close', () => {
    const panel = actor()
    panel.send({ type: 'OPEN' })
    panel.send({ type: 'CLOSE' })
    expect(panel.getSnapshot().value).toBe('closed')
    panel.send({ type: 'OPEN' })
    panel.send({ type: 'SHOW_PROVENANCE' })
    panel.send({ type: 'CLOSE' })
    expect(panel.getSnapshot().value).toBe('closed')
  })

  it('re-selecting a star drops a stale provenance view back to meta', () => {
    const panel = actor()
    panel.send({ type: 'OPEN' })
    panel.send({ type: 'SHOW_PROVENANCE' })
    expect(panel.getSnapshot().value).toBe('provenance')
    panel.send({ type: 'OPEN' })
    expect(panel.getSnapshot().value).toBe('meta')
  })

  it('leaves the phase intact on RECALL / OPEN_DIARY (emitted intents, not view changes)', () => {
    const panel = actor()
    panel.send({ type: 'OPEN' })
    panel.send({ type: 'RECALL' })
    expect(panel.getSnapshot().value).toBe('meta')
    panel.send({ type: 'OPEN_DIARY' })
    expect(panel.getSnapshot().value).toBe('meta')
  })
})

describe('resolveSelection', () => {
  const memory = { id: 'm1', name: 'Market run' } as EpisodicMemory
  const neuron = { id: 'n1', name: 'market', neuronType: 'spatial' } as Neuron
  const stores = { episodicById: { m1: memory }, neuronById: { n1: neuron } }

  it('resolves a null selection to none', () => {
    expect(resolveSelection(null, stores)).toEqual({ kind: 'none' })
  })

  it('resolves an episodic-memory id to the episodic star', () => {
    expect(resolveSelection('m1', stores)).toEqual({ kind: 'episodic', memory })
  })

  it('resolves a neuron id to the neuron', () => {
    expect(resolveSelection('n1', stores)).toEqual({ kind: 'neuron', neuron })
  })

  it('resolves an unknown id to none', () => {
    expect(resolveSelection('ghost', stores)).toEqual({ kind: 'none' })
  })

  it('routes a recognized gist body to the paid gist view before the episodic lookup', () => {
    const gistStores = {
      ...stores,
      resolveGist: (id: string) =>
        id === 'gist:2:m1' ? { episodicMemoryId: 'm1', stage: 2 } : null,
    }
    expect(resolveSelection('gist:2:m1', gistStores)).toEqual({
      kind: 'gist',
      episodicMemoryId: 'm1',
      stage: 2,
    })
    // A non-gist id still resolves normally through the same recognizer.
    expect(resolveSelection('m1', gistStores)).toEqual({ kind: 'episodic', memory })
  })

  it('routes the real gist-layer id format through the injected parser', () => {
    const gistStores = { ...stores, resolveGist: parseGistNodeId }
    expect(resolveSelection(gistNodeId('m1', 3), gistStores)).toEqual({
      kind: 'gist',
      episodicMemoryId: 'm1',
      stage: 3,
    })
  })
})
