import { describe, expect, it } from 'vitest'

import {
  GIST_INSTANCE_DIFFUSE,
  GIST_INSTANCE_TINT,
  type InstanceAttributeChannel,
} from '@cosimosi/3d-renderer'
import { gistNodeId, type GistStarInstance } from '@cosimosi/universe'

import {
  createGistRenderSnapshot,
  createGistRiseState,
  gistSelectionAt,
  mapGistInstancePosition,
  reconcileGistRiseState,
  type GistRenderSnapshot,
} from './GistStarLayer.tsx'

function instance(
  memoryId: string,
  stage: number,
  overrides: Partial<GistStarInstance> = {},
): GistStarInstance {
  return {
    memoryId,
    stage,
    nodeId: gistNodeId(memoryId, stage),
    z: 15 + stage,
    color: [stage / 10, stage / 5, stage / 4],
    size: 0.5 + stage / 10,
    softness: 0.6 + stage / 20,
    ...overrides,
  }
}

function attribute(snapshot: GistRenderSnapshot, name: string): InstanceAttributeChannel {
  const channel = snapshot.channels.attributes?.find((candidate) => candidate.name === name)
  if (!channel) throw new Error(`missing channel ${name}`)
  return channel
}

function expectConsistentSnapshot(
  snapshot: GistRenderSnapshot,
  expected: readonly GistStarInstance[],
  buffer: Float32Array,
) {
  expect(snapshot.count).toBe(expected.length)
  expect(snapshot.instances).toEqual(expected)
  expect(snapshot.positionSlots).toHaveLength(snapshot.count)
  expect(snapshot.channels.scales).toHaveLength(snapshot.count)
  expect(attribute(snapshot, GIST_INSTANCE_TINT).array).toHaveLength(snapshot.count * 3)
  expect(attribute(snapshot, GIST_INSTANCE_DIFFUSE).array).toHaveLength(snapshot.count)

  const riseState = createGistRiseState()
  expect(reconcileGistRiseState(riseState, snapshot, true)).toEqual([])
  for (let index = 0; index < snapshot.count; index++) {
    const source = expected[index]
    const slot = snapshot.positionSlots[index]
    expect(slot).toBeDefined()
    const out = new Float32Array(3)
    expect(mapGistInstancePosition(snapshot, riseState, index, buffer, out, 0)).toBe(true)
    expect(Array.from(out)).toEqual([buffer[slot! * 3], buffer[slot! * 3 + 1], source.z])
    expect(gistSelectionAt(snapshot, index)).toEqual({
      memoryId: source.memoryId,
      stage: source.stage,
    })
    expect(snapshot.channels.scales?.[index]).toBeCloseTo(source.size, 6)
    expect(
      Array.from(attribute(snapshot, GIST_INSTANCE_TINT).array.slice(index * 3, index * 3 + 3)),
    ).toEqual(Array.from(new Float32Array(source.color)))
    expect(attribute(snapshot, GIST_INSTANCE_DIFFUSE).array[index]).toBeCloseTo(source.softness, 6)
  }
}

describe('gist render snapshot', () => {
  const alpha = instance('alpha', 1)
  const beta = instance('beta', 1, {
    color: [0.8, 0.3, 0.1],
    size: 0.9,
    softness: 0.72,
  })
  const gamma = instance('gamma', 2, {
    color: [0.2, 0.7, 0.4],
    size: 1.1,
    softness: 0.88,
  })
  const buffer = new Float32Array([20, 21, 22, 10, 11, 12, 30, 31, 32])
  const slots = { alpha: 1, beta: 0, gamma: 2 }

  it('keeps count, channels, position source, and selection aligned through add/remove/reorder', () => {
    const updates = [
      [alpha, beta],
      [beta, gamma, alpha],
      [gamma, alpha],
    ] as const

    for (const update of updates) {
      expectConsistentSnapshot(createGistRenderSnapshot(update, slots), update, buffer)
    }
  })

  it('keeps the committed callbacks on the committed order when another snapshot is abandoned', () => {
    const committed = createGistRenderSnapshot([alpha, beta], slots)
    const riseState = createGistRiseState()
    reconcileGistRiseState(riseState, committed, true)
    const committedPosition = (index: number, out: Float32Array) =>
      mapGistInstancePosition(committed, riseState, index, buffer, out, 0)
    const committedSelection = (index: number) => gistSelectionAt(committed, index)

    createGistRenderSnapshot([beta, gamma, alpha], slots)

    const out = new Float32Array(3)
    expect(committedPosition(0, out)).toBe(true)
    expect(Array.from(out)).toEqual([10, 11, alpha.z])
    expect(committedSelection(0)).toEqual({ memoryId: 'alpha', stage: 1 })
    expect(committed.channels.scales?.[0]).toBeCloseTo(alpha.size, 6)
  })

  it('settles initial hydration silently, delays a new body until the post-commit diff, and rises once', () => {
    const riseState = createGistRiseState()
    const riseBuffer = buffer.slice()
    const hydrated = createGistRenderSnapshot([alpha], slots)
    expect(reconcileGistRiseState(riseState, hydrated, true)).toEqual([])

    const risenAlpha = instance('alpha', 2)
    const advanced = createGistRenderSnapshot([alpha, risenAlpha], slots)
    const out = new Float32Array(3)
    expect(mapGistInstancePosition(advanced, riseState, 1, riseBuffer, out, 4)).toBe(false)
    expect(reconcileGistRiseState(riseState, advanced, true)).toEqual([
      { memoryId: 'alpha', stage: 2 },
    ])
    expect(reconcileGistRiseState(riseState, advanced, true)).toEqual([])

    expect(mapGistInstancePosition(advanced, riseState, 1, riseBuffer, out, 4)).toBe(true)
    expect(Array.from(out)).toEqual([10, 11, 12])
    riseBuffer[5] = -40
    expect(mapGistInstancePosition(advanced, riseState, 1, riseBuffer, out, 100)).toBe(true)
    expect(Array.from(out)).toEqual([10, 11, risenAlpha.z])

    reconcileGistRiseState(riseState, hydrated, true)
    expect(riseState.seen.has(risenAlpha.nodeId)).toBe(false)
  })

  it('marks an initially empty gist projection as hydrated when memories are already loaded', () => {
    const riseState = createGistRiseState()
    const empty = createGistRenderSnapshot([], slots)
    expect(reconcileGistRiseState(riseState, empty, true)).toEqual([])
    const firstRise = createGistRenderSnapshot([alpha], slots)
    expect(reconcileGistRiseState(riseState, firstRise, true)).toEqual([
      { memoryId: 'alpha', stage: 1 },
    ])
  })

  it('hides instances with no committed sim-slot source without disturbing neighboring picks', () => {
    const snapshot = createGistRenderSnapshot([alpha, beta], { alpha: 1 })
    const riseState = createGistRiseState()
    reconcileGistRiseState(riseState, snapshot, true)

    expect(mapGistInstancePosition(snapshot, riseState, 1, buffer, new Float32Array(3), 0)).toBe(
      false,
    )
    expect(gistSelectionAt(snapshot, 1)).toEqual({ memoryId: 'beta', stage: 1 })
  })
})
