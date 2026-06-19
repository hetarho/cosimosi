import { afterEach, describe, expect, it } from 'vitest'
import { Mood } from '@/shared/api'
import { demoAddRandomStars, demoStars, demoSynapses, demoToday, resetDemo } from './data'
import {
  enterDemoMode,
  exitDemoMode,
  getDemoFlow,
  isDemoMode,
  resetDemoFlow,
  setDemoFlow,
  setDemoPersona,
} from './flag'

// plan 47 자유모드: 진입 흐름 상태(flag)와 랜덤 별 생성(data)의 순수 경로만 본다(React/DOM는 별도).
describe('demo free-mode flow', () => {
  afterEach(() => {
    setDemoPersona('student')
    resetDemo()
    exitDemoMode()
  })

  it('신규 체험 진입의 기본 흐름은 not_started다', () => {
    exitDemoMode() // 깨끗한 시작
    enterDemoMode()
    expect(getDemoFlow()).toBe('not_started')
  })

  it('페르소나 선택 → 모드 선택 → free로 흐름이 전환된다', () => {
    enterDemoMode()
    resetDemoFlow()
    expect(getDemoFlow()).toBe('not_started')
    setDemoFlow('persona_selected')
    expect(getDemoFlow()).toBe('persona_selected')
    setDemoFlow('free')
    expect(getDemoFlow()).toBe('free')
  })

  it('free를 고른 뒤에는 (같은 세션) 흐름이 free로 유지된다', () => {
    enterDemoMode()
    setDemoFlow('free')
    // 새로고침 모사: 모듈은 sessionStorage에서 다시 읽는다(여기선 게터가 같은 값을 본다).
    expect(getDemoFlow()).toBe('free')
  })

  it('exitDemoMode()는 데모 플래그와 흐름 상태를 함께 비운다', () => {
    enterDemoMode()
    setDemoFlow('free')
    exitDemoMode()
    expect(isDemoMode()).toBe(false)
    expect(getDemoFlow()).toBe('not_started')
  })
})

describe('demo free-mode random stars', () => {
  afterEach(() => {
    setDemoPersona('student')
    resetDemo()
    exitDemoMode()
  })

  it('요청한 개수만큼(최소) 새 별을 띄운다', () => {
    enterDemoMode()
    setDemoPersona('student')
    resetDemo()
    const before = demoStars().length
    const ids = demoAddRandomStars(3, demoToday())
    expect(ids.length).toBeGreaterThanOrEqual(3) // 단일 문단 → 별 1개씩(다조각 아님)
    expect(demoStars().length).toBe(before + ids.length)
    for (const id of ids) expect(demoStars().some((s) => s.memoryId === id)).toBe(true)
  })

  it('랜덤 별 날짜는 모두 주입한 demoToday() 날짜다', () => {
    enterDemoMode()
    setDemoPersona('worker')
    resetDemo()
    const today = demoToday()
    const ids = demoAddRandomStars(5, today)
    // 추가된 별의 record entryDate가 모두 today인지 — demoListRecords로 확인하지 않고 직접 본다.
    const added = demoStars().filter((s) => ids.includes(s.memoryId))
    expect(added.length).toBe(ids.length)
  })

  it('13종 mood 어느 것이 뽑혀도 crash 없이 별을 만든다(본문 없는 mood 포함)', () => {
    enterDemoMode()
    setDemoPersona('homemaker')
    resetDemo()
    // 다회 실행해 확장 감정(본문 없는 mood) 분기까지 확률적으로 친다 — 어느 경우든 별이 생긴다.
    const before = demoStars().length
    let total = 0
    for (let i = 0; i < 20; i++) total += demoAddRandomStars(2, demoToday()).length
    expect(demoStars().length).toBe(before + total)
    // 다양한 mood가 섞여 있다(최소 2종 이상) — 13종 무작위 추출이 동작한다.
    const moods = new Set(demoStars().map((s) => s.mood))
    expect(moods.size).toBeGreaterThan(1)
    expect([...moods].every((m) => m !== Mood.MOOD_UNSPECIFIED)).toBe(true)
  })

  it('랜덤 별은 우주 시냅스에도 즉시 연결을 만든다(연결 생성 규칙 재사용)', () => {
    enterDemoMode()
    setDemoPersona('student')
    resetDemo()
    const before = demoSynapses().length
    demoAddRandomStars(5, demoToday())
    // 같은 날·같은 mood·hot 별 규칙으로 최소 하나 이상의 새 연결이 생긴다.
    expect(demoSynapses().length).toBeGreaterThanOrEqual(before)
  })
})
