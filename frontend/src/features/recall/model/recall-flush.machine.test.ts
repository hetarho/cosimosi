import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createActor, fromPromise, type Actor } from 'xstate'

// 부수효과/플랫폼 모듈 차단(provide로 flush 액터 대체 — 실제 RPC 미호출). co-recall.ts는 순수라 그대로 사용.
vi.mock('@/shared/lib', () => ({ capture: vi.fn(), EVENTS: { reinforceFlush: 'reinforce_flush' } }))
vi.mock('@/shared/lib/demo', () => ({ isDemoMode: () => false, virtualNowMs: () => 1000 }))
vi.mock('@/entities/synapse', () => ({ useSynapseStore: { getState: () => ({ bumpEdgeWeight: vi.fn() }) } }))
vi.mock('../api/recall', () => ({ reinforceLinks: vi.fn() }))

import { recallFlushMachine } from './recall-flush.machine'
import { DEBOUNCE_IDLE_MS } from './co-recall'

type FlushInput = { items: { aId: string; bId: string; deltaWeight: number }[]; batchId: string }

function provided(flush: (a: { input: FlushInput }) => Promise<void>) {
  return recallFlushMachine.provide({ actors: { flush: fromPromise(flush) } })
}
type A = Actor<typeof recallFlushMachine>
const deltaSize = (a: A) => a.getSnapshot().context.session.deltas.size
const batchId = (a: A) => a.getSnapshot().context.session.batchId

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('recallFlushMachine', () => {
  it('누적 → 디바운스 → flush 성공 → idle + batchId 회전 + 드레인', async () => {
    const a = createActor(provided(async () => {})).start()
    const b0 = batchId(a)
    a.send({ type: 'RECORD_VIEW', id: 's1' })
    a.send({ type: 'RECORD_VIEW', id: 's2' }) // s1↔s2 페어 +delta
    expect(a.getSnapshot().value).toBe('accumulating')
    expect(deltaSize(a)).toBe(1)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_IDLE_MS) // 디바운스 → flushing → flush 해소 → onDone
    expect(a.getSnapshot().value).toBe('idle')
    expect(batchId(a)).not.toBe(b0) // 성공 시 회전
    expect(deltaSize(a)).toBe(0) // 드레인됨
    a.stop()
  })

  it('flush 실패 → 같은 batchId로 재병합 → 재시도(멱등)', async () => {
    const batchIds: string[] = []
    let calls = 0
    const a = createActor(
      provided(async ({ input }) => {
        batchIds.push(input.batchId)
        calls += 1
        if (calls === 1) throw new Error('net')
        return undefined
      }),
    ).start()
    const b0 = batchId(a)
    a.send({ type: 'RECORD_VIEW', id: 's1' })
    a.send({ type: 'RECORD_VIEW', id: 's2' })
    await vi.advanceTimersByTimeAsync(DEBOUNCE_IDLE_MS) // flush #1 → throw → onError → 재병합 → accumulating
    expect(a.getSnapshot().value).toBe('accumulating')
    expect(deltaSize(a)).toBe(1) // 재병합됨
    expect(batchId(a)).toBe(b0) // 같은 batchId 유지
    await vi.advanceTimersByTimeAsync(DEBOUNCE_IDLE_MS) // 재시도 → flush #2 → 성공 → idle
    expect(a.getSnapshot().value).toBe('idle')
    expect(calls).toBe(2)
    expect(batchIds[0]).toBe(batchIds[1]) // 두 전송이 같은 멱등키 → 서버 dedup
    a.stop()
  })

  it('전송 중 열람 → 다음 배치로 누적', async () => {
    let resolveFlush: (() => void) | undefined
    const a = createActor(provided(() => new Promise<void>((r) => (resolveFlush = r)))).start()
    a.send({ type: 'RECORD_VIEW', id: 's1' })
    a.send({ type: 'RECORD_VIEW', id: 's2' })
    await vi.advanceTimersByTimeAsync(DEBOUNCE_IDLE_MS) // → flushing(미해소), 드레인
    expect(a.getSnapshot().value).toBe('flushing')
    expect(deltaSize(a)).toBe(0)
    a.send({ type: 'RECORD_VIEW', id: 's3' }) // 전송 중 → 다음 배치(s2↔s3)
    expect(deltaSize(a)).toBe(1)
    resolveFlush?.()
    await vi.advanceTimersByTimeAsync(0) // onDone → pending → accumulating
    expect(a.getSnapshot().value).toBe('accumulating')
    a.stop()
  })

  it('flushing 중 RESET → idle + 새 세션(전송 결과 드롭 — 출처 경계 가드 구조화)', async () => {
    let resolveFlush: (() => void) | undefined
    const a = createActor(provided(() => new Promise<void>((r) => (resolveFlush = r)))).start()
    const b0 = batchId(a)
    a.send({ type: 'RECORD_VIEW', id: 's1' })
    a.send({ type: 'RECORD_VIEW', id: 's2' })
    await vi.advanceTimersByTimeAsync(DEBOUNCE_IDLE_MS)
    expect(a.getSnapshot().value).toBe('flushing')
    a.send({ type: 'RESET' }) // 전송 중 출처 경계 리셋
    expect(a.getSnapshot().value).toBe('idle')
    const bReset = batchId(a)
    expect(bReset).not.toBe(b0) // 새 세션
    resolveFlush?.() // 뒤늦은 해소 — invoke가 취소돼 onDone 미발화
    await vi.advanceTimersByTimeAsync(0)
    expect(a.getSnapshot().value).toBe('idle')
    expect(batchId(a)).toBe(bReset) // stale onDone이 회전시키지 않음
    a.stop()
  })

  it('같은 별 재열람 → 델타 없음 → 디바운스 후 idle(보낼 것 없음)', async () => {
    const a = createActor(provided(async () => {})).start()
    a.send({ type: 'RECORD_VIEW', id: 's1' })
    a.send({ type: 'RECORD_VIEW', id: 's1' }) // 같은 id → 페어 없음
    expect(deltaSize(a)).toBe(0)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_IDLE_MS)
    expect(a.getSnapshot().value).toBe('idle')
    a.stop()
  })
})
