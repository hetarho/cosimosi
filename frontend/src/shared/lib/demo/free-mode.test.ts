import { afterEach, describe, expect, it } from 'vitest'
import { Mood } from '@/shared/api'
import {
  advanceDemoGenesis,
  beginDemoCompose,
  demoComposeSegments,
  demoRecordMemory,
  demoStars,
  demoSynapses,
  ensureDemoGenesisArmed,
  resetDemo,
} from './data'
import { tutorialFixture } from './tutorial-fixture'
import { genesisDay, genesisTotalDays, isGenesisActive } from './genesis'
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

// change 28 genesis: 자유모드 = 빈 우주에서 30일 시뮬. 난수는 입력에만(세션마다 다름)이라 정확한 별
// 수는 못 박지 않고, 결정론적으로 참인 골조만 본다 — 빈 출발(A1)·30일 후 종료(A6)·자라남(A3)·튜토리얼
// 정적 코퍼스 보존(회귀 경계)·리셋 재시작(A8).
describe('demo genesis (change 28)', () => {
  afterEach(() => {
    setDemoPersona('student')
    resetDemo()
    exitDemoMode()
  })

  it('자유모드는 빈 우주에서 시작하고 genesis가 켜진다(A1)', () => {
    enterDemoMode()
    setDemoPersona('student')
    setDemoFlow('free')
    resetDemo()
    expect(ensureDemoGenesisArmed()).toBe(true)
    expect(demoStars().length).toBe(0)
    expect(demoSynapses().length).toBe(0)
  })

  it('30일을 모두 진행하면 genesis가 종료되고 우주가 자라 있다(A3·A6)', () => {
    enterDemoMode()
    setDemoPersona('student')
    setDemoFlow('free')
    resetDemo()
    ensureDemoGenesisArmed()
    const total = genesisTotalDays()
    for (let i = 0; i < total; i++) advanceDemoGenesis()
    expect(isGenesisActive()).toBe(false)
    expect(genesisDay()).toBe(total)
    // student write_prob=0.7 → 30일에 한 편도 안 쓸 확률은 사실상 0(0.3^30). 별이 태어났다.
    expect(demoStars().length).toBeGreaterThan(0)
    // 종료 후 추가 advanceDemoGenesis는 무동작(별 수 불변).
    const after = demoStars().length
    advanceDemoGenesis()
    expect(demoStars().length).toBe(after)
  })

  it('온보딩(persona_selected — 비 free·비 tutorial)은 정적 코퍼스를 그대로 시드한다 — genesis 미적용(회귀 경계)', () => {
    enterDemoMode()
    setDemoPersona('student')
    setDemoFlow('persona_selected')
    resetDemo()
    expect(ensureDemoGenesisArmed()).toBe(false)
    expect(demoStars().length).toBeGreaterThan(0) // 온보딩 배경 캔버스용 성숙 코퍼스 우주
  })

  it('튜토리얼로 전환되면 genesis가 더 별을 빚지 않는다(회귀 경계 — flow≠free 가드)', () => {
    enterDemoMode()
    setDemoPersona('student')
    setDemoFlow('free')
    resetDemo()
    ensureDemoGenesisArmed()
    for (let i = 0; i < 5; i++) advanceDemoGenesis() // 5일치 진행
    setDemoFlow('tutorial') // "둘러보기 다시 보기" 등으로 튜토리얼 진입(genesis 아직 active일 수 있음)
    const before = demoStars().length
    advanceDemoGenesis() // flow=tutorial → 가드로 무동작
    expect(demoStars().length).toBe(before)
  })

  it('처음으로(resetDemo) 경계는 genesis를 빈 우주에서 다시 시작한다(A8)', () => {
    enterDemoMode()
    setDemoPersona('homemaker')
    setDemoFlow('free')
    resetDemo()
    ensureDemoGenesisArmed()
    for (let i = 0; i < genesisTotalDays(); i++) advanceDemoGenesis()
    expect(isGenesisActive()).toBe(false)
    resetDemo() // 처음으로/페르소나 전환 경계
    expect(ensureDemoGenesisArmed()).toBe(true)
    expect(demoStars().length).toBe(0)
  })
})

// change 34 첫 별 튜토리얼: 데모 튜토리얼은 빈 우주에서 출발하고(A1), 제출은 고정 fixture 별/id로 빚는다(A7).
describe('demo tutorial fixture (change 34)', () => {
  afterEach(() => {
    setDemoPersona('student')
    resetDemo()
    exitDemoMode()
  })

  it('튜토리얼 flow는 빈 우주에서 시작한다 — genesis도 정적 코퍼스도 아니다(A1)', () => {
    enterDemoMode()
    setDemoPersona('student')
    setDemoFlow('tutorial')
    resetDemo()
    expect(demoStars().length).toBe(0)
    expect(demoSynapses().length).toBe(0)
    expect(ensureDemoGenesisArmed()).toBe(false) // genesis 미적용
  })

  it('튜토리얼 작성은 고정 fixture 본문·조각·id로 별을 빚는다(A7)', () => {
    enterDemoMode()
    setDemoPersona('student')
    setDemoFlow('tutorial')
    resetDemo()
    const fixture = tutorialFixture('student')
    const { body } = beginDemoCompose()
    expect(body).toBe(fixture.body)
    const segs = demoComposeSegments()
    expect(segs.length).toBe(fixture.fragments.length)
    const { recordId, memoryIds } = demoRecordMemory({ body, entryDate: '2026-06-23', fragments: segs })
    expect(recordId).toBe(fixture.recordId) // 랜덤 id가 아니라 고정 fixture id
    expect(memoryIds).toEqual(fixture.memoryIds)
    for (const id of memoryIds) expect(demoStars().some((s) => s.memoryId === id)).toBe(true)
  })
})
