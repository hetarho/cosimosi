// tour.machine 순수 단위 테스트(change 13) — React 없이 createActor+send+getSnapshot로 진행 시퀀스와
// 게이팅을 고정한다. 항해 실습 navSampler는 placeholder(noop)라 자동 진행하지 않으므로 테스트가
// PRACTICE_MET를 직접 보내 실습 충족을 흉내 낸다.
import { createActor } from 'xstate'
import { describe, expect, test } from 'vitest'
import { TOUR_STEPS } from './steps'
import { tourMachine, selectCanNext, selectIsDone, selectIsNavPractice } from './tour.machine'

function start(step = 0) {
  const a = createActor(tourMachine, { input: { startStep: step } })
  a.start()
  return a
}
const stepIdx = (a: ReturnType<typeof start>) => a.getSnapshot().context.stepIndex
const phaseIdx = (a: ReturnType<typeof start>) => a.getSnapshot().context.phaseIndex

describe('tour.machine 진행·게이팅', () => {
  test('정보 phase는 can(NEXT)=true이고 NEXT로 다음 step으로 진행한다', () => {
    const a = start(1) // 'theme' — 단일 정보 phase
    expect(selectCanNext(a.getSnapshot())).toBe(true)
    a.send({ type: 'NEXT' })
    expect(stepIdx(a)).toBe(2) // 마지막 phase였으니 다음 step(persona)
    expect(phaseIdx(a)).toBe(0)
  })

  test('행동 phase는 can(NEXT)=false — NEXT는 무시되고 관찰 이벤트로만 진행한다', () => {
    const a = start(2) // persona: phase0 = persona-open(행동)
    expect(selectCanNext(a.getSnapshot())).toBe(false)
    a.send({ type: 'NEXT' }) // 무시되어야 한다
    expect(phaseIdx(a)).toBe(0)
    a.send({ type: 'POPOVER_CHANGED', popover: 'persona' }) // persona-open 충족
    expect(phaseIdx(a)).toBe(1) // persona-changed phase
  })

  test('persona-changed는 진입 baseline과 다를 때만 진행한다', () => {
    const a = start(2)
    a.send({ type: 'PERSONA_CHANGED', persona: 'student' }) // 현재 관찰 페르소나
    a.send({ type: 'POPOVER_CHANGED', popover: 'persona' }) // phase0 → phase1(baseline=student)
    expect(phaseIdx(a)).toBe(1)
    a.send({ type: 'PERSONA_CHANGED', persona: 'student' }) // 같음 → 진행 안 함
    expect(phaseIdx(a)).toBe(1)
    a.send({ type: 'PERSONA_CHANGED', persona: 'worker' }) // 다름 → 진행
    expect(phaseIdx(a)).toBe(2) // 마무리 정보 phase
  })

  test('UI 숨김/보이기 행동 phase를 차례로 충족하면 정보 phase로, 그다음 NEXT로 다음 step', () => {
    const a = start(0) // ui-toggle: ui-hidden → ui-shown → 정보
    a.send({ type: 'UI_TOGGLED', hidden: true }) // ui-hidden 충족
    expect(stepIdx(a)).toBe(0)
    expect(phaseIdx(a)).toBe(1)
    a.send({ type: 'UI_TOGGLED', hidden: false }) // ui-shown 충족
    expect(phaseIdx(a)).toBe(2)
    expect(selectCanNext(a.getSnapshot())).toBe(true) // 정보 phase
    a.send({ type: 'NEXT' })
    expect(stepIdx(a)).toBe(1) // theme
  })

  test('항해 실습 phase는 nav-practice 태그·can(NEXT)=false, PRACTICE_MET로 진행한다', () => {
    const a = start(4) // 시점 전환: phase0 = 정보(nebula)
    expect(selectIsNavPractice(a.getSnapshot())).toBe(false)
    a.send({ type: 'NEXT' }) // 정보 → phase1(nebula-rotated, 실습)
    expect(selectIsNavPractice(a.getSnapshot())).toBe(true)
    expect(selectCanNext(a.getSnapshot())).toBe(false)
    a.send({ type: 'PRACTICE_MET' })
    expect(phaseIdx(a)).toBe(2) // nebula-zoomed(실습)
    expect(selectIsNavPractice(a.getSnapshot())).toBe(true)
  })

  test('PREV는 step 경계를 넘어 이전 step 마지막 phase로 돌아간다', () => {
    const a = start(1) // theme phase0
    a.send({ type: 'PREV' })
    expect(stepIdx(a)).toBe(0) // ui-toggle
    expect(phaseIdx(a)).toBe(TOUR_STEPS[0].phases.length - 1) // 마지막 phase
  })

  test('EXIT은 done으로 수렴한다', () => {
    const a = start(1)
    a.send({ type: 'EXIT' })
    expect(selectIsDone(a.getSnapshot())).toBe(true)
  })

  test('마지막 단계의 마지막 phase에서 NEXT는 done으로 수렴한다', () => {
    const a = start(TOUR_STEPS.length - 1) // 'end' — 단일 정보 phase
    expect(selectCanNext(a.getSnapshot())).toBe(true)
    a.send({ type: 'NEXT' })
    expect(selectIsDone(a.getSnapshot())).toBe(true)
  })

  test('RESET은 done에서도 커서를 맞춰 재진입한다(다시 보기)', () => {
    const a = start(3)
    a.send({ type: 'EXIT' })
    expect(selectIsDone(a.getSnapshot())).toBe(true)
    a.send({ type: 'RESET', step: 0 })
    expect(selectIsDone(a.getSnapshot())).toBe(false)
    expect(stepIdx(a)).toBe(0)
    expect(phaseIdx(a)).toBe(0)
  })
})
