import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import {
  focusMachine,
  selectFocusedStarId,
  selectHighlightedRecordId,
  selectFrameNonce,
} from './focus.machine'

const start = () => createActor(focusMachine).start()

describe('focusMachine', () => {
  it('초기: idle, 포커스 없음', () => {
    const a = start()
    expect(a.getSnapshot().value).toBe('idle')
    expect(selectFocusedStarId(a.getSnapshot())).toBeNull()
    expect(selectHighlightedRecordId(a.getSnapshot())).toBeNull()
    a.stop()
  })

  it('SELECT_STAR → star(id), 회상 selectedId 노출', () => {
    const a = start()
    a.send({ type: 'SELECT_STAR', id: 's1' })
    expect(a.getSnapshot().matches('star')).toBe(true)
    expect(selectFocusedStarId(a.getSnapshot())).toBe('s1')
    expect(selectHighlightedRecordId(a.getSnapshot())).toBeNull()
    a.stop()
  })

  // 본 스펙의 핵심: 일기 목록 클릭(SELECT_DIARY)과 회상 패널 "이 일기의 다른 별들"(SEE_DIARY_STARS)이
  // 같은 diary(recordId) 상태로 수렴 — 구현상 두 진입점이 어긋날 여지가 없다(불일치 버그 구조적 제거).
  it('SELECT_DIARY와 SEE_DIARY_STARS는 동일하게 diary(recordId)에 도달', () => {
    const a = start()
    a.send({ type: 'SELECT_DIARY', recordId: 'r1' })
    const viaList = a.getSnapshot()
    a.stop()

    const b = start()
    b.send({ type: 'SEE_DIARY_STARS', recordId: 'r1' })
    const viaPanel = b.getSnapshot()
    b.stop()

    expect(viaList.value).toBe('diary')
    expect(viaPanel.value).toBe('diary')
    expect(selectHighlightedRecordId(viaList)).toBe('r1')
    expect(selectHighlightedRecordId(viaPanel)).toBe('r1')
    expect(viaList.value).toEqual(viaPanel.value)
  })

  it('배타: 별 포커스 중 SELECT_DIARY → diary로, selectedId는 null(동시 불가)', () => {
    const a = start()
    a.send({ type: 'SELECT_STAR', id: 's1' })
    a.send({ type: 'SEE_DIARY_STARS', recordId: 'r1' })
    expect(a.getSnapshot().matches('diary')).toBe(true)
    expect(selectFocusedStarId(a.getSnapshot())).toBeNull() // 별 선택 해제됨(구조적)
    expect(selectHighlightedRecordId(a.getSnapshot())).toBe('r1')
    a.stop()
  })

  it('frameNonce: 같은 일기를 다시 골라도 증가 → frame-all 재발화', () => {
    const a = start()
    a.send({ type: 'SELECT_DIARY', recordId: 'r1' })
    const n1 = selectFrameNonce(a.getSnapshot())
    a.send({ type: 'SELECT_DIARY', recordId: 'r1' }) // 같은 일기 재선택
    const n2 = selectFrameNonce(a.getSnapshot())
    expect(n2).toBe(n1 + 1)
    a.stop()
  })

  it('DISMISS: 별/일기 어느 상태에서든 idle로 복귀(배경 탭 복귀)', () => {
    const a = start()
    a.send({ type: 'SELECT_STAR', id: 's1' })
    a.send({ type: 'DISMISS' })
    expect(a.getSnapshot().matches('idle')).toBe(true)
    expect(selectFocusedStarId(a.getSnapshot())).toBeNull()
    a.send({ type: 'SELECT_DIARY', recordId: 'r1' })
    a.send({ type: 'DISMISS' })
    expect(a.getSnapshot().matches('idle')).toBe(true)
    expect(selectHighlightedRecordId(a.getSnapshot())).toBeNull()
    a.stop()
  })
})
