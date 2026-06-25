// tour.machine 순수 단위 테스트(change 34) — React 없이 createActor+send+getSnapshot로 첫 별 흐름의 진행
// 시퀀스·게이팅·맥락 필터를 고정한다. 항해 실습 navSampler는 placeholder(noop)라 테스트가 PRACTICE_MET를
// 직접 보내 충족을 흉내 낸다.
import { createActor } from 'xstate'
import { describe, expect, test } from 'vitest'
import { activeSteps, type TourContext } from './steps'
import {
  tourMachine,
  selectCanNext,
  selectIsDone,
  selectIsNavPractice,
  selectCameraLocked,
  selectStepId,
  selectTotal,
} from './tour.machine'

function start(context: TourContext = 'demo', step = 0) {
  const a = createActor(tourMachine, { input: { context, startStep: step } })
  a.start()
  return a
}
const stepIdx = (a: ReturnType<typeof start>) => a.getSnapshot().context.stepIndex
const phaseIdx = (a: ReturnType<typeof start>) => a.getSnapshot().context.phaseIndex

describe('tour.machine 첫 별 흐름·게이팅(change 34)', () => {
  test('첫 단계는 action(빈 우주 안내 + 새 별 띄우기) — can(NEXT)=false, 작성 폼 열림으로 진행한다(A4)', () => {
    const a = start('demo', 0)
    expect(selectStepId(a.getSnapshot())).toBe('empty-intro')
    expect(selectCanNext(a.getSnapshot())).toBe(false)
    a.send({ type: 'NEXT' }) // 무시되어야 한다(action)
    expect(stepIdx(a)).toBe(0)
    a.send({ type: 'COMPOSE_CHANGED', open: true, phase: 'compose' }) // compose-open 충족
    expect(selectStepId(a.getSnapshot())).toBe('compose')
    expect(phaseIdx(a)).toBe(0)
  })

  test('작성 단계: 정보→별 나누기(action)→정보→별 띄우기(action)→생성 별 단계(A5·A6)', () => {
    const a = start('demo', 1) // compose
    expect(selectCanNext(a.getSnapshot())).toBe(true) // compose-body 정보 phase
    a.send({ type: 'NEXT' })
    expect(phaseIdx(a)).toBe(1) // segment 행동 phase
    expect(selectCanNext(a.getSnapshot())).toBe(false)
    a.send({ type: 'COMPOSE_CHANGED', open: true, phase: 'review' }) // segmented 충족
    expect(phaseIdx(a)).toBe(2) // review-panel 정보 phase
    expect(selectCanNext(a.getSnapshot())).toBe(true)
    a.send({ type: 'NEXT' })
    expect(phaseIdx(a)).toBe(3) // submit-stars 행동 phase
    expect(selectCanNext(a.getSnapshot())).toBe(false)
    a.send({ type: 'SUBMITTED' }) // submitted 충족 → 다음 단계
    expect(selectStepId(a.getSnapshot())).toBe('generated-star')
  })

  test('생성 별 단계는 action — 별 클릭(STAR_FOCUSED)으로 회상 패널 단계로 진행한다(A10)', () => {
    const a = start('demo', 2) // generated-star
    expect(selectCanNext(a.getSnapshot())).toBe(false)
    a.send({ type: 'STAR_FOCUSED', id: 'demo-tutorial-student-f0' })
    expect(selectStepId(a.getSnapshot())).toBe('recall-panel')
  })

  test('회상 패널은 정보 2 phase → 망원경 단계로(`다음`으로 진행)', () => {
    const a = start('demo', 3) // recall-panel
    expect(selectCanNext(a.getSnapshot())).toBe(true)
    a.send({ type: 'NEXT' })
    expect(phaseIdx(a)).toBe(1)
    a.send({ type: 'NEXT' })
    expect(selectStepId(a.getSnapshot())).toBe('telescope')
  })

  test('카메라 lock: 빈 우주~회상은 잠기고, 망원경부터 풀린다(A9·A12)', () => {
    for (const [step, locked] of [
      [0, true], // empty-intro
      [2, true], // generated-star
      [3, true], // recall-panel
      [4, false], // telescope
      [5, false], // view
    ] as const) {
      expect(selectCameraLocked(start('demo', step).getSnapshot())).toBe(locked)
    }
  })

  test('망원경: 일기 패널(정보) → 별 탭(action, 탭 전환으로 진행) → 별 패널(정보)(A13·A14)', () => {
    const a = start('demo', 4) // telescope
    a.send({ type: 'EXPLORER_TOGGLED', open: true }) // explorer-open 충족(망원경 버튼)
    expect(phaseIdx(a)).toBe(1) // 일기 패널 정보 phase
    expect(selectCanNext(a.getSnapshot())).toBe(true)
    a.send({ type: 'NEXT' })
    expect(phaseIdx(a)).toBe(2) // 별 탭 행동 phase
    expect(selectCanNext(a.getSnapshot())).toBe(false)
    a.send({ type: 'EXPLORER_TAB_CHANGED', tab: 'star' }) // explorer-star-selected 충족
    expect(phaseIdx(a)).toBe(3) // 별 패널 정보 phase
  })

  test('항해 실습은 nav-practice 태그·can(NEXT)=false, PRACTICE_MET로 진행한다', () => {
    const a = start('demo', 5) // view: phase0 정보(nebula)
    expect(selectIsNavPractice(a.getSnapshot())).toBe(false)
    a.send({ type: 'NEXT' }) // → phase1 nebula-rotated(실습)
    expect(selectIsNavPractice(a.getSnapshot())).toBe(true)
    expect(selectCanNext(a.getSnapshot())).toBe(false)
    a.send({ type: 'PRACTICE_MET' })
    expect(phaseIdx(a)).toBe(2) // nebula-zoomed(실습)
  })

  test('account 맥락은 데모 페르소나/시간 단계가 없다(A16)', () => {
    const accountIds = activeSteps('account').map((s) => s.id)
    expect(accountIds).not.toContain('persona')
    expect(accountIds).not.toContain('time')
    expect(activeSteps('demo')).toContainEqual(expect.objectContaining({ id: 'persona' }))
    // 총 단계 수도 맥락별로 다르다(데모 = account + 페르소나·시간 2단계).
    expect(selectTotal(start('account').getSnapshot())).toBe(activeSteps('account').length)
    expect(selectTotal(start('demo').getSnapshot())).toBe(activeSteps('account').length + 2)
  })

  test('EXIT은 done으로, RESET은 done에서도 맥락+커서를 맞춰 재진입한다(다시 보기)', () => {
    const a = start('demo', 3)
    a.send({ type: 'EXIT' })
    expect(selectIsDone(a.getSnapshot())).toBe(true)
    a.send({ type: 'RESET', step: 0, context: 'account' })
    expect(selectIsDone(a.getSnapshot())).toBe(false)
    expect(stepIdx(a)).toBe(0)
    expect(selectStepId(a.getSnapshot())).toBe('empty-intro')
  })
})
