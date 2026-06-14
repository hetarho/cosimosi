import { afterEach, describe, expect, it } from 'vitest'
import { demoStars } from './data'
import { resetDemo } from './data'
import { enterDemoMode, exitDemoMode, getDemoPersona, setDemoPersona } from './flag'
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
})
