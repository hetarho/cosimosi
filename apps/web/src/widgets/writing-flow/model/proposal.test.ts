import type { SplitDiaryResponse } from '@cosimosi/api-client'
import { describe, expect, it } from 'vitest'

import {
  draftsFromResponse,
  mergeMemory,
  renameMemory,
  setMemoryMood,
  splitMemory,
  type ProposedMemoryDraft,
} from './proposal.ts'

const sample: ProposedMemoryDraft[] = [
  { id: 'a', name: 'Morning', mood: 'JOY', neurons: [{ name: 'cafe', type: 'entity' }, { name: 'quiet', type: 'semantic' }] },
  { id: 'b', name: 'Meeting', mood: 'STRESS', neurons: [{ name: 'quiet', type: 'semantic' }, { name: 'office', type: 'spatial' }] },
  { id: 'c', name: 'Evening', mood: 'CALM', neurons: [{ name: 'home', type: 'spatial' }] },
]

describe('draftsFromResponse', () => {
  it('maps a split response to the editable proposal (name / mood / membership)', () => {
    const response = {
      memories: [{ name: 'A', mood: 'JOY', neurons: [{ name: 'n1', type: 'entity' }] }],
    } as unknown as SplitDiaryResponse
    const [draft] = draftsFromResponse(response)
    expect(draft).toMatchObject({ name: 'A', mood: 'JOY', neurons: [{ name: 'n1', type: 'entity' }] })
  })

  it('assigns each proposed memory a distinct stable id (for React keys)', () => {
    const response = {
      memories: [
        { name: 'A', mood: 'JOY', neurons: [] },
        { name: 'B', mood: 'SAD', neurons: [] },
      ],
    } as unknown as SplitDiaryResponse
    const [a, b] = draftsFromResponse(response)
    expect(a?.id).toBeTruthy()
    expect(a?.id).not.toBe(b?.id)
  })
})

describe('hand-edit helpers', () => {
  it('renames only the target memory, preserving its id', () => {
    const next = renameMemory(sample, 0, 'Dawn')
    expect(next[0]?.name).toBe('Dawn')
    expect(next[0]?.id).toBe('a')
    expect(next[1]?.name).toBe('Meeting')
  })

  it('changes only the target memory mood', () => {
    const next = setMemoryMood(sample, 1, 'CALM')
    expect(next[1]?.mood).toBe('CALM')
    expect(next[0]?.mood).toBe('JOY')
  })

  it('merges a memory with the next, unioning neuron membership deduped and keeping the first id', () => {
    const next = mergeMemory(sample, 0)
    expect(next).toHaveLength(2)
    expect(next[0]?.id).toBe('a')
    expect(next[0]?.name).toBe('Morning')
    expect(next[0]?.mood).toBe('JOY')
    expect(next[0]?.neurons.map((neuron) => neuron.name)).toEqual(['cafe', 'quiet', 'office'])
  })

  it('leaves the list unchanged when merging the last memory', () => {
    expect(mergeMemory(sample, 2)).toEqual(sample)
  })

  it('refuses to merge below the encode minimum (2)', () => {
    const two = sample.slice(0, 2)
    expect(mergeMemory(two, 0)).toEqual(two)
  })

  it('splits a memory into two, halving neuron membership and giving the new half a fresh id', () => {
    const next = splitMemory(sample, 0)
    expect(next).toHaveLength(4)
    expect(next[0]?.id).toBe('a')
    expect(next[1]?.id).not.toBe('a')
    expect(next[0]?.neurons.map((neuron) => neuron.name)).toEqual(['cafe'])
    expect(next[1]?.neurons.map((neuron) => neuron.name)).toEqual(['quiet'])
  })

  it('splits a single-neuron memory by copying the neuron to both sides', () => {
    const one: ProposedMemoryDraft[] = [{ id: 'solo', name: 'Solo', mood: 'CALM', neurons: [{ name: 'sea', type: 'entity' }] }]
    const next = splitMemory(one, 0)
    expect(next).toHaveLength(2)
    expect(next[0]?.neurons).toHaveLength(1)
    expect(next[1]?.neurons).toHaveLength(1)
  })

  it('refuses to split beyond the encode maximum (5)', () => {
    const five: ProposedMemoryDraft[] = Array.from({ length: 5 }, (_, index) => ({
      id: `x${index}`,
      name: `M${index}`,
      mood: 'CALM',
      neurons: [{ name: 'n', type: 'entity' }],
    }))
    expect(splitMemory(five, 0)).toEqual(five)
  })
})
