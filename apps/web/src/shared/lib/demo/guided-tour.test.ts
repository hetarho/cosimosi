import { afterEach, describe, expect, it } from 'vitest'
import {
  completeTutorial,
  enterTutorialMode,
  exitDemoMode,
  getDemoFlow,
  getTutorialStep,
  restartTutorial,
  setDemoFlow,
  setTutorialStep,
  enterDemoMode,
} from './flag'

// plan 48 튜토리얼 투어: 진입 흐름(tutorial)·step 상태(flag)의 순수 경로만 본다.
describe('demo guided-tour flow', () => {
  afterEach(() => {
    exitDemoMode()
  })

  it('모드 선택에서 튜토리얼 진입 → flow=tutorial, step 0', () => {
    enterDemoMode()
    setDemoFlow('persona_selected')
    enterTutorialMode()
    expect(getDemoFlow()).toBe('tutorial')
    expect(getTutorialStep()).toBe(0)
  })

  it('step을 저장/복원한다', () => {
    enterDemoMode()
    enterTutorialMode()
    setTutorialStep(4)
    expect(getTutorialStep()).toBe(4)
    // 음수/비정수는 0으로 방어한다.
    setTutorialStep(-2)
    expect(getTutorialStep()).toBe(0)
  })

  it('완료/건너뛰기는 free로 수렴하고 step을 0으로 비운다', () => {
    enterDemoMode()
    enterTutorialMode()
    setTutorialStep(7)
    completeTutorial()
    expect(getDemoFlow()).toBe('free')
    expect(getTutorialStep()).toBe(0)
  })

  it('다시 보기는 free에서 tutorial step 0으로 되돌린다', () => {
    enterDemoMode()
    setDemoFlow('free')
    restartTutorial()
    expect(getDemoFlow()).toBe('tutorial')
    expect(getTutorialStep()).toBe(0)
  })

  it('exitDemoMode()는 tutorial flow와 step 상태를 함께 지운다', () => {
    enterDemoMode()
    enterTutorialMode()
    setTutorialStep(5)
    exitDemoMode()
    expect(getDemoFlow()).toBe('not_started')
    expect(getTutorialStep()).toBe(0)
  })
})
