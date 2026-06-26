import { afterEach, describe, expect, it } from 'vitest'
import { demoConsolidate, demoStars, demoSynapses, resetDemo } from './data'
import { advanceDemoClock, demoClock, demoOffsetDays, setDemoClockSpeed } from './clock'
import { enterDemoMode, exitDemoMode, setDemoPersona } from './flag'

// 야간 공고화(change 20 포트)가 배속 흐름에서 실제로 도는지 — 추상화 단계 상승·링크 재가중(시간↓/
// 의미↑)·삭제 없음을 고정한다. 가상 시계 읽기값(demoClock)이 배속만큼 흐르고 04:00마다 날짜가 오르는지도.
const seed = (persona: 'student' | 'worker' | 'homemaker' = 'student') => {
  enterDemoMode()
  setDemoPersona(persona)
  resetDemo()
}
const avg = (ns: number[]) => ns.reduce((a, b) => a + b, 0) / Math.max(1, ns.length)
const weightsOf = (type: string) => demoSynapses().filter((e) => e.linkType === type).map((e) => e.weight)

describe('demo virtual clock (demoClock)', () => {
  afterEach(() => {
    setDemoPersona('student')
    resetDemo()
    exitDemoMode()
  })

  it('진입 직후 1일째이고, KST 시:분을 0..23/0..59로 돌려준다', () => {
    seed()
    const c = demoClock()
    expect(c.day).toBe(1)
    expect(c.hour).toBeGreaterThanOrEqual(0)
    expect(c.hour).toBeLessThan(24)
    expect(c.minute).toBeGreaterThanOrEqual(0)
    expect(c.minute).toBeLessThan(60)
  })

  it('배속으로 시간을 흘리면 며칠째가 오르고 04:00 경계 수와 정합한다', () => {
    seed()
    setDemoClockSpeed(1) // 1시간/초
    const boundaries = advanceDemoClock(720_000) // 720,000ms = 720시간 = 30일
    expect(boundaries).toBe(30)
    expect(demoOffsetDays()).toBe(30)
    // day는 04:00 버킷 기준이라 30일 흐른 뒤 31일째(또는 위상에 따라 30~31). 최소 30 이상은 확실.
    expect(demoClock().day).toBeGreaterThanOrEqual(30)
  })
})

describe('demo nightly consolidation (demoConsolidate)', () => {
  afterEach(() => {
    setDemoPersona('student')
    resetDemo()
    exitDemoMode()
  })

  it('시간이 지나면 추상화 단계가 0→상승하고 별·선은 삭제되지 않는다', () => {
    seed()
    const stars0 = demoStars().length
    const syn0 = demoSynapses().length
    const stageSum0 = demoStars().reduce((a, s) => a + s.abstractionStage, 0)

    setDemoClockSpeed(1)
    const n = advanceDemoClock(720_000) // 30일
    for (let i = 0; i < n; i++) demoConsolidate()

    const stageSum1 = demoStars().reduce((a, s) => a + s.abstractionStage, 0)
    expect(demoStars().some((s) => s.abstractionStage > 0)).toBe(true) // 멀어진 별이 요지화됨
    expect(stageSum1).toBeGreaterThan(stageSum0) // 시간이 지나며 총 추상화가 증가(단조 승급)
    expect(demoStars().length).toBe(stars0) // 별 삭제 0(헌법2)
    expect(demoSynapses().length).toBe(syn0) // 선 삭제 0(헌법2)
  })

  it('재가중: 시간·일내 결속은 약화되고 의미 링크는 강화(캡)된다', () => {
    seed()
    const intraBefore = avg(weightsOf('intra_entry'))
    const semBefore = avg(weightsOf('semantic'))

    setDemoClockSpeed(1)
    const n = advanceDemoClock(720_000) // 30일
    for (let i = 0; i < n; i++) demoConsolidate()

    const intraAfter = avg(weightsOf('intra_entry'))
    const semAfter = avg(weightsOf('semantic'))
    // 시간/일내 결속 ×0.97^30 ≈ 0.40배로 약화
    if (Number.isFinite(intraBefore) && intraBefore > 0) expect(intraAfter).toBeLessThan(intraBefore)
    // 의미 링크는 +0.01/밤(캡 0.79)으로 강화(이미 캡이면 동률)
    if (Number.isFinite(semBefore) && semBefore > 0) expect(semAfter).toBeGreaterThanOrEqual(semBefore)
  })
})
