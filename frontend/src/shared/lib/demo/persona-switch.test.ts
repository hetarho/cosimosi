import { afterEach, describe, expect, it } from 'vitest'
import { Mood } from '@/shared/api'
import {
  demoAddMultiSceneStar,
  demoAddStar,
  demoConsolidate,
  demoStars,
  demoSynapses,
  demoToday,
  resetDemo,
} from './data'
import { advanceDemoClock, consolidationBoundariesCrossed, demoOffsetDays, setDemoClockSpeed } from './clock'
import {
  enterDemoMode,
  exitDemoMode,
  getDemoPersona,
  parseDemoFlow,
  parseDemoPersona,
  setDemoPersona,
} from './flag'
import { CORPORA } from './personas'

// 페르소나 전환의 데이터 경로(스토어 재시드)만 본다(three/refetch는 별도). switchDemoPersona의
// resetDemo + setDemoPersona가 다음 demoStars()를 새 페르소나로 다시 빚는지 고정한다.
const starCountOf = (id: 'student' | 'worker' | 'homemaker') =>
  CORPORA[id].diaries.reduce((n, d) => n + d.fragments.length, 0)

describe('demo persona data switch', () => {
  afterEach(() => {
    setDemoPersona('student')
    resetDemo()
    exitDemoMode()
  })

  it('기본 페르소나(student)로 시드된다', () => {
    enterDemoMode()
    setDemoPersona('student')
    resetDemo()
    expect(getDemoPersona()).toBe('student')
    expect(demoStars().length).toBe(starCountOf('student'))
  })

  it('parser는 알 수 없는 persona/flow를 안전 기본값으로 돌린다', () => {
    expect(parseDemoPersona('worker')).toBe('worker')
    expect(parseDemoPersona('unknown')).toBe('student')
    expect(parseDemoPersona(null)).toBe('student')
    expect(parseDemoFlow('tutorial')).toBe('tutorial')
    expect(parseDemoFlow('unknown')).toBe('not_started')
    expect(parseDemoFlow(null)).toBe('not_started')
  })

  it('페르소나를 바꾸면 다음 시드가 그 우주로 바뀐다', () => {
    enterDemoMode()
    setDemoPersona('student')
    resetDemo()
    const student = demoStars().length
    expect(student).toBe(starCountOf('student'))

    // switchDemoPersona가 하는 일: setDemoPersona + resetDemo → 다음 demoStars()가 재시드.
    setDemoPersona('worker')
    resetDemo()
    const worker = demoStars().length
    expect(worker).toBe(starCountOf('worker'))
    expect(worker).not.toBe(student)

    setDemoPersona('homemaker')
    resetDemo()
    expect(demoStars().length).toBe(starCountOf('homemaker'))
  })

  it('resetDemo 없이 페르소나만 바꾸면(seededAt 가드) 옛 우주가 남는다 — 전환은 반드시 reset 동반', () => {
    enterDemoMode()
    setDemoPersona('student')
    resetDemo()
    const before = demoStars().length
    setDemoPersona('worker') // 영속만, reset 안 함
    expect(demoStars().length).toBe(before) // seededAt 가드로 옛 우주 유지(전환 로직이 reset을 부르는 이유)
  })

  it('04:00 경계 검출은 (a,b] 안의 24h-간격 경계를 정확히 센다(누락·중복 없음)', () => {
    const DAY = 86_400_000
    const t0 = 1_700_000_000_000 // 임의의 고정 기준
    expect(consolidationBoundariesCrossed(t0, t0)).toBe(0)
    // 정확히 N일을 더하면 bucket이 정확히 N 증가한다(시작 위상 무관 — k·DAY 가산은 floor를 k 증가).
    expect(consolidationBoundariesCrossed(t0, t0 + 30 * DAY)).toBe(30)
    expect(consolidationBoundariesCrossed(t0, t0 + DAY)).toBe(1)
    expect(consolidationBoundariesCrossed(t0 + DAY, t0)).toBe(0) // 음수 클램프
  })

  it('30일치 배속 흐름은 04:00 경계마다 공고화하되 별·선 개수를 삭제하지 않는다', () => {
    enterDemoMode()
    setDemoPersona('student')
    resetDemo()
    const starsBefore = demoStars().length
    const synapsesBefore = demoSynapses().length

    // 1시간/초 배속에서 720,000ms(=720시간=30일)를 흘리면 정확히 30개 야간 경계를 지난다.
    setDemoClockSpeed(1)
    const boundaries = advanceDemoClock(720_000)
    expect(boundaries).toBe(30)
    for (let i = 0; i < boundaries; i++) demoConsolidate()

    expect(demoOffsetDays()).toBe(30)
    expect(demoStars().length).toBe(starsBefore)
    expect(demoSynapses().length).toBe(synapsesBefore)
  })

  it('별 추가와 다감정 하루 추가는 새 별과 연결을 만든다', () => {
    enterDemoMode()
    setDemoPersona('student')
    resetDemo()
    const starsBefore = demoStars().length
    const synapsesBefore = demoSynapses().length

    const id = demoAddStar(Mood.JOY, demoToday())
    expect(demoStars().some((s) => s.memoryId === id)).toBe(true)
    expect(demoStars().length).toBe(starsBefore + 1)
    expect(demoSynapses().some((e) => e.aId === id || e.bId === id)).toBe(true)

    const ids = demoAddMultiSceneStar(demoToday())
    expect(ids.length).toBeGreaterThan(1)
    expect(demoStars().length).toBe(starsBefore + 1 + ids.length)
    expect(demoSynapses().length).toBeGreaterThan(synapsesBefore)
    expect(demoSynapses().some((e) => ids.includes(e.aId) && ids.includes(e.bId))).toBe(true)
  })
})
