import { afterEach, describe, expect, it } from 'vitest'
import { Mood } from '@/shared/api'
import {
  beginDemoCompose,
  demoComposeSegments,
  demoRecordMemory,
  demoStars,
  demoSynapses,
  resetDemo,
} from './data'
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

describe('demo free-mode preset diary write flow (change 25)', () => {
  afterEach(() => {
    setDemoPersona('student')
    resetDemo()
    exitDemoMode()
  })

  it('beginDemoCompose는 read-only 프리셋 본문·오늘 날짜를 돌려준다', () => {
    enterDemoMode()
    setDemoPersona('student')
    resetDemo()
    const { body, entryDate } = beginDemoCompose()
    expect(body.length).toBeGreaterThan(0)
    expect(entryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('별 나누기(demoComposeSegments)는 사전분절 조각을 valence와 함께 돌려준다', () => {
    enterDemoMode()
    setDemoPersona('student')
    resetDemo()
    beginDemoCompose() // 활성 프리셋 세팅
    const segs = demoComposeSegments()
    expect(segs.length).toBeGreaterThanOrEqual(1)
    for (const s of segs) {
      expect(s.text.length).toBeGreaterThan(0)
      expect(s.mood).not.toBe(Mood.MOOD_UNSPECIFIED)
      expect(typeof s.valence).toBe('number')
    }
  })

  it('demoRecordMemory는 조각마다 별을 띄우고 일내 결속으로 묶는다', () => {
    enterDemoMode()
    setDemoPersona('student')
    resetDemo()
    const before = demoStars().length
    const synBefore = demoSynapses().length
    beginDemoCompose()
    const segs = demoComposeSegments()
    const { recordId, memoryIds } = demoRecordMemory({
      body: segs.map((s) => s.text).join('\n\n'),
      entryDate: '2026-06-23',
      fragments: segs,
    })
    expect(memoryIds.length).toBe(segs.length)
    expect(demoStars().length).toBe(before + segs.length)
    for (const id of memoryIds) expect(demoStars().some((s) => s.memoryId === id)).toBe(true)
    // 같은 일기 조각은 같은 recordId(spec 28)로 묶이고, 다조각이면 일내 결속선이 생긴다.
    for (const id of memoryIds)
      expect(demoStars().find((s) => s.memoryId === id)?.recordId).toBe(recordId)
    if (segs.length > 1) {
      const intra = demoSynapses().filter(
        (e) => memoryIds.includes(e.aId) && memoryIds.includes(e.bId),
      )
      expect(intra.length).toBeGreaterThan(0)
      expect(intra.every((e) => e.linkType === 'intra_entry')).toBe(true)
    }
    expect(demoSynapses().length).toBeGreaterThanOrEqual(synBefore)
  })

  it('제출 후 활성 프리셋이 비워져 다음 작성이 새 일기를 고른다', () => {
    enterDemoMode()
    setDemoPersona('worker')
    resetDemo()
    beginDemoCompose()
    const segs = demoComposeSegments()
    demoRecordMemory({ body: segs.map((s) => s.text).join('\n\n'), entryDate: '2026-06-23', fragments: segs })
    // 활성 프리셋이 비워졌으므로 새로 beginDemoCompose를 부르기 전엔 분절이 빈다.
    expect(demoComposeSegments().length).toBe(0)
  })
})
