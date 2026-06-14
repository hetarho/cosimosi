import { describe, it, expect, vi } from 'vitest'
import { createActor, fromPromise, type Actor, type SnapshotFrom } from 'xstate'
import type { DraftFragment } from '../api/record-memory'

// 머신이 import하는 부수효과/플랫폼 모듈을 막는다(provide로 액터 대체 — 실제 RPC는 호출 안 됨).
vi.mock('@/shared/api', () => ({ Mood: { NEUTRAL: 7 } }))
vi.mock('@/shared/lib', () => ({
  capture: vi.fn(),
  EVENTS: { recordMemory: 'record_memory' },
  bodyLengthBucket: () => 'short',
}))
vi.mock('../api/record-memory', () => ({
  MAX_BODY_CHARS: 4000,
  MAX_FRAGMENTS: 10,
  BODY_TOO_LONG_MSG: 'too-long',
  EMPTY_FRAGMENT_MSG: 'empty-fragment',
  segmentErrorMessage: () => 'seg-err',
  recordErrorMessage: () => 'rec-err',
  segmentMemory: vi.fn(),
  recordMemory: vi.fn(),
}))

import { capture } from '@/shared/lib'
import {
  composeMachine,
  selectPhase,
  selectBody,
  selectErrorText,
  selectFragments,
} from './compose.machine'

type Snap = SnapshotFrom<typeof composeMachine>

const frag = (text: string): DraftFragment => ({ id: crypto.randomUUID(), text, mood: 7, intensity: 0.5, valence: 0 })

function provided(opts: {
  segment?: () => Promise<DraftFragment[]>
  submit?: () => Promise<{ recordId: string; memoryIds: string[] }>
}) {
  return composeMachine.provide({
    actors: {
      segment: fromPromise(opts.segment ?? (async () => [frag('조각')])),
      submit: fromPromise(opts.submit ?? (async () => ({ recordId: 'r', memoryIds: ['m'] }))),
    },
  })
}

function waitFor(actor: Actor<typeof composeMachine>, pred: (s: Snap) => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (pred(actor.getSnapshot())) return resolve()
    const sub = actor.subscribe((s) => {
      if (pred(s)) {
        sub.unsubscribe()
        resolve()
      }
    })
  })
}

describe('composeMachine', () => {
  it('초기: composing, 빈 본문', () => {
    const a = createActor(provided({})).start()
    expect(selectPhase(a.getSnapshot())).toBe('compose')
    expect(selectBody(a.getSnapshot())).toBe('')
    a.stop()
  })

  it('SEGMENT(유효 본문) → segmenting → reviewing(조각 도착)', async () => {
    const a = createActor(provided({ segment: async () => [frag('a'), frag('b')] })).start()
    a.send({ type: 'SET_BODY', body: '오늘의 기억' })
    a.send({ type: 'SEGMENT' })
    await waitFor(a, (s) => s.matches('reviewing'))
    expect(selectPhase(a.getSnapshot())).toBe('review')
    expect(selectFragments(a.getSnapshot())).toHaveLength(2)
    a.stop()
  })

  it('SEGMENT(빈 본문) → composing 유지 + 에러', () => {
    const a = createActor(provided({})).start()
    a.send({ type: 'SEGMENT' }) // body 비어 있음
    expect(a.getSnapshot().matches('composing')).toBe(true)
    expect(selectErrorText(a.getSnapshot())).toBe('일기 본문을 입력하세요')
    a.stop()
  })

  it('SUBMIT 성공 → composing 리셋 + emit(submitted)', async () => {
    const a = createActor(provided({ segment: async () => [frag('조각')] })).start()
    const onSubmitted = vi.fn()
    a.on('submitted', onSubmitted)
    a.send({ type: 'SET_BODY', body: '본문' })
    a.send({ type: 'SEGMENT' })
    await waitFor(a, (s) => s.matches('reviewing'))
    vi.mocked(capture).mockClear()
    a.send({ type: 'SUBMIT' })
    await waitFor(a, (s) => s.matches('composing'))
    expect(onSubmitted).toHaveBeenCalledTimes(1) // 페이지가 이걸 받아 쿼리 무효화
    expect(selectBody(a.getSnapshot())).toBe('') // 드래프트 리셋
    expect(selectFragments(a.getSnapshot())).toHaveLength(0)
    // 분석은 리셋 "전" context로 — fragment_count가 0이 아니어야(captureSuccess가 resetDraft보다 먼저).
    expect(capture).toHaveBeenCalledWith(
      'record_memory',
      expect.objectContaining({ fragment_count: 1, success: true }),
    )
    a.stop()
  })

  it('SUBMIT(빈 조각 텍스트) → reviewing 유지 + 에러', async () => {
    const a = createActor(provided({ segment: async () => [frag('')] })).start() // 빈 텍스트 조각
    a.send({ type: 'SET_BODY', body: '본문' })
    a.send({ type: 'SEGMENT' })
    await waitFor(a, (s) => s.matches('reviewing'))
    a.send({ type: 'SUBMIT' })
    expect(a.getSnapshot().matches('reviewing')).toBe(true) // 제출 안 됨
    expect(selectErrorText(a.getSnapshot())).toBe('empty-fragment')
    a.stop()
  })

  it('SUBMIT 실패 → reviewing 유지 + 서버 에러 메시지', async () => {
    const a = createActor(
      provided({
        segment: async () => [frag('조각')],
        submit: async () => {
          throw new Error('boom')
        },
      }),
    ).start()
    a.send({ type: 'SET_BODY', body: '본문' })
    a.send({ type: 'SEGMENT' })
    await waitFor(a, (s) => s.matches('reviewing'))
    a.send({ type: 'SUBMIT' })
    await waitFor(a, (s) => s.matches('reviewing') && selectErrorText(s) === 'rec-err')
    expect(selectErrorText(a.getSnapshot())).toBe('rec-err')
    a.stop()
  })

  it('UPDATE_FRAGMENT: 조각 편집 → 텍스트 갱신 + nonce 굴림', async () => {
    const a = createActor(provided({ segment: async () => [frag('처음')] })).start()
    a.send({ type: 'SET_BODY', body: '본문' })
    a.send({ type: 'SEGMENT' })
    await waitFor(a, (s) => s.matches('reviewing'))
    const id = selectFragments(a.getSnapshot())[0].id
    const nonce0 = a.getSnapshot().context.submitNonce
    a.send({ type: 'UPDATE_FRAGMENT', id, patch: { text: '고침' } })
    expect(selectFragments(a.getSnapshot())[0].text).toBe('고침')
    expect(a.getSnapshot().context.submitNonce).not.toBe(nonce0)
    a.stop()
  })
})
