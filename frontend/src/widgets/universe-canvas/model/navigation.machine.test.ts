import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import {
  navigationMachine,
  selectIsNebula,
  selectIsRecall,
  selectTransitioning,
  selectFlyStarId,
  selectFrameRecordId,
  selectFrameSeq,
  selectHeadingMode,
} from './navigation.machine'

const start = () => createActor(navigationMachine).start()

describe('navigationMachine', () => {
  it('초기: nebula, 비전환', () => {
    const a = start()
    expect(selectIsNebula(a.getSnapshot())).toBe(true)
    expect(selectTransitioning(a.getSnapshot())).toBe(false)
    a.stop()
  })

  it('TOGGLE_MODE: nebula→modeTransition(recall)→(ARRIVED)→recall', () => {
    const a = start()
    a.send({ type: 'TOGGLE_MODE' })
    expect(a.getSnapshot().matches('modeTransition')).toBe(true)
    expect(selectTransitioning(a.getSnapshot())).toBe(true) // 전환 중 클램프 완화
    a.send({ type: 'ARRIVED' })
    expect(selectIsRecall(a.getSnapshot())).toBe(true)
    expect(selectTransitioning(a.getSnapshot())).toBe(false)
    // 다시 토글 → nebula로
    a.send({ type: 'TOGGLE_MODE' })
    a.send({ type: 'ARRIVED' })
    expect(selectIsNebula(a.getSnapshot())).toBe(true)
    a.stop()
  })

  it('FLY_TO_STAR: flyingToStar(#transitioning)→(ARRIVED)→recall', () => {
    const a = start()
    a.send({ type: 'FLY_TO_STAR', id: 's1' })
    expect(a.getSnapshot().matches('flyingToStar')).toBe(true)
    expect(selectFlyStarId(a.getSnapshot())).toBe('s1')
    expect(selectTransitioning(a.getSnapshot())).toBe(true)
    a.send({ type: 'ARRIVED' })
    expect(selectIsRecall(a.getSnapshot())).toBe(true)
    expect(selectFlyStarId(a.getSnapshot())).toBeNull()
    a.stop()
  })

  it('FRAME_DIARY: framingDiary(#transitioning)→(ARRIVED)→nebula', () => {
    const a = start()
    a.send({ type: 'TOGGLE_MODE' }) // recall로
    a.send({ type: 'ARRIVED' })
    a.send({ type: 'FRAME_DIARY', recordId: 'r1' })
    expect(a.getSnapshot().matches('framingDiary')).toBe(true)
    expect(selectFrameRecordId(a.getSnapshot())).toBe('r1')
    expect(selectTransitioning(a.getSnapshot())).toBe(true)
    a.send({ type: 'ARRIVED' })
    expect(selectIsNebula(a.getSnapshot())).toBe(true) // 조망은 nebula에서 끝
    a.stop()
  })

  it('frameSeq: 같은 일기 재조망도 증가 → frame-all 재발화', () => {
    const a = start()
    a.send({ type: 'FRAME_DIARY', recordId: 'r1' })
    const n1 = selectFrameSeq(a.getSnapshot())
    a.send({ type: 'FRAME_DIARY', recordId: 'r1' }) // 같은 일기 재조망(framingDiary 자기 전이)
    expect(selectFrameSeq(a.getSnapshot())).toBe(n1 + 1)
    a.stop()
  })

  it('SET_MOVE: 어느 상태에서든 context.move 부분 병합', () => {
    const a = start()
    a.send({ type: 'SET_MOVE', move: { z: 1 } })
    expect(a.getSnapshot().context.move).toEqual({ x: 0, y: 0, z: 1 })
    a.send({ type: 'SET_MOVE', move: { x: -1 } })
    expect(a.getSnapshot().context.move).toEqual({ x: -1, y: 0, z: 1 })
    a.stop()
  })

  it('비행 중 인터럽트: flyingToStar 중 FRAME_DIARY → framingDiary로 전환(FlyTo 컨트롤러가 양보)', () => {
    const a = start()
    a.send({ type: 'FLY_TO_STAR', id: 's1' })
    expect(a.getSnapshot().matches('flyingToStar')).toBe(true)
    a.send({ type: 'FRAME_DIARY', recordId: 'r1' }) // 비행 중 일기 조망 진입
    expect(a.getSnapshot().matches('framingDiary')).toBe(true) // nav가 flyingToStar를 떠난다
    expect(selectFrameRecordId(a.getSnapshot())).toBe('r1')
    a.stop()
  })

  it('selectHeadingMode: 비행 중 도착 모드를 보여준다(HUD 라벨)', () => {
    const a = start()
    expect(selectHeadingMode(a.getSnapshot())).toBe('nebula')
    a.send({ type: 'FLY_TO_STAR', id: 's1' })
    expect(selectHeadingMode(a.getSnapshot())).toBe('recall') // flyingToStar는 recall로 향함
    a.stop()
  })
})
