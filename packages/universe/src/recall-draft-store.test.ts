import { beforeEach, describe, expect, it } from 'vitest'
import { assembleRecallText, useRecallDraftStore } from './recall-draft-store.ts'

const spans = [
  { text: 'I ', lost: false },
  { text: 'xxxx xxxx', lost: true },
  { text: ' at ', lost: false },
  { text: 'xxxx', lost: true },
  { text: ' today.', lost: false },
]
beforeEach(() => useRecallDraftStore.getState().reset())
describe('partial recall draft', () => {
  it('requires every blank and preserves every legible run', () => {
    expect(assembleRecallText(spans, {})).toBeNull()
    expect(assembleRecallText(spans, { 1: 'met a friend', 3: '  ' })).toBeNull()
    expect(assembleRecallText(spans, { 1: ' met a friend ', 3: 'home' })).toBe(
      'I met a friend at home today.',
    )
  })
  it('never lets an answer edit a legible run and clears private drafts', () => {
    const store = useRecallDraftStore.getState()
    store.prepare(spans)
    store.setAnswer(0, 'replace the beginning')
    expect(useRecallDraftStore.getState().answers).toEqual({})
    store.setAnswer(1, 'met a friend')
    store.setAnswer(3, 'home')
    expect(useRecallDraftStore.getState().rewrite).toBe('I met a friend at home today.')
    expect(
      useRecallDraftStore
        .getState()
        .parts?.filter((part) => part.lost)
        .map((part) => part.blankNumber),
    ).toEqual([1, 2])
    store.reset()
    expect(useRecallDraftStore.getState()).toMatchObject({ parts: null, answers: {}, rewrite: '' })
  })
  it('can reinforce a fully legible memory without inventing a blank', () => {
    useRecallDraftStore.getState().prepare([{ text: 'As written.', lost: false }])
    expect(useRecallDraftStore.getState().rewrite).toBe('As written.')
    expect(assembleRecallText([], {})).toBeNull()
  })
})
