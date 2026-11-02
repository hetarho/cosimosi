import { describe, expect, it } from 'vitest'
import type { OnboardingSignalReport } from '@cosimosi/onboarding'

import { onboardingReportAction } from './use-universe-screen.ts'

const report = (signal: string) => ({ signal, nonce: 1 }) as unknown as OnboardingSignalReport

describe('onboardingReportAction', () => {
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
