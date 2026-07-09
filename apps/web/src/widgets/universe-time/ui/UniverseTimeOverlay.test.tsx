import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'
import { useUniverseClockStore } from '@cosimosi/universe'

import { useAdvanceAnnouncementStore } from '../../../features/accelerate-time/index.ts'
import { useTimeSyncConsentStore } from '../../../features/confirm-time-sync/index.ts'
import { UniverseTimeOverlay } from './UniverseTimeOverlay.tsx'

// The web overlay is the DOM host of the shared sequencing (machine + stores + advanceSweepFrame).
// The SSR-string harness runs the render but no effects and reads zustand's *initial* snapshot, so
// it cannot drive the rAF sweep, the portal dialog, or the unmount cleanup — those live-render
// interactions are pinned by the mobile UniverseTimeOverlay test (jest + @testing-library/react-
// native). This side pins what the harness can prove: the idle composition renders the HUD, opens
// no consent modal, and shows no dilation veil — no acceleration runs until an announce lands.
describe('UniverseTimeOverlay (web)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
    // Reset the shared stores so a prior test can't leave a pending announce/consent behind. (SSR
    // reads the initial snapshot regardless, but this keeps intent explicit.)
    useUniverseClockStore.getState().clear()
    useAdvanceAnnouncementStore.getState().take()
    useTimeSyncConsentStore.getState().settle('cancel')
  })

  it('renders the idle HUD — no consent modal, no dilation veil', () => {
    const html = renderToString(createElement(UniverseTimeOverlay))
    // The persistent "우주의 시간" HUD is always present.
    expect(html).toContain(m.universe_time_hud_label())
    // Idle clock is unborn (SSR initial snapshot) → the empty-universe affordance, not a date.
    expect(html).toContain(m.universe_time_hud_empty())
    // The consent dialog is closed and the acceleration veil is not mounted.
    expect(html).not.toContain(m.universe_time_sync_consent_body())
    expect(html).not.toContain('radial-gradient')
  })
})
