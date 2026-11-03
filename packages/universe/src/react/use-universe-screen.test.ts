import { describe, expect, it } from 'vitest'
import type { OnboardingSignalReport } from '@cosimosi/onboarding'

import { onboardingReportAction, takeOnboardingReport } from './use-universe-screen.ts'

const report = (signal: string) => ({ signal, nonce: 1 }) as unknown as OnboardingSignalReport

describe('onboardingReportAction', () => {
  it('retains all real actions when the user finishes writing before the welcome has ended', () => {
    const held = new Map<string, OnboardingSignalReport>()
    for (const signal of ['writing-flow-opened', 'split-succeeded', 'launch-succeeded']) {
      expect(takeOnboardingReport(held, report(signal), true, null)).toBeNull()
    }
    expect(takeOnboardingReport(held, null, true, 'writing-flow-opened')?.signal).toBe(
      'writing-flow-opened',
    )
    expect(takeOnboardingReport(held, null, true, 'split-succeeded')?.signal).toBe(
      'split-succeeded',
    )
    expect(takeOnboardingReport(held, null, true, null)).toBeNull()
    expect(takeOnboardingReport(held, null, true, 'launch-succeeded')?.signal).toBe(
      'launch-succeeded',
    )
    expect(takeOnboardingReport(held, null, true, 'launch-succeeded')).toBeNull()
  })

  it('discards held actions when a run ends so replay waits for fresh user actions', () => {
    const held = new Map<string, OnboardingSignalReport>()
    takeOnboardingReport(held, report('launch-succeeded'), true, null)
    takeOnboardingReport(held, null, false, null)
    expect(takeOnboardingReport(held, null, true, 'launch-succeeded')).toBeNull()
  })
  it('holds a report that arrives before the step awaiting it, instead of dropping it', () => {
    expect(onboardingReportAction(report('launched'), true, null)).toBe('hold')
    expect(onboardingReportAction(report('launched'), true, 'split-reviewed')).toBe('hold')
  })

  it('advances when the running step awaits exactly that signal', () => {
    expect(onboardingReportAction(report('launched'), true, 'launched')).toBe('advance')
  })

  it('clears a report with no run active, so it cannot survive into a later run', () => {
    expect(onboardingReportAction(report('launched'), false, 'launched')).toBe('clear')
  })

  it('does nothing without a report', () => {
    expect(onboardingReportAction(null, true, 'launched')).toBe('none')
  })
})
