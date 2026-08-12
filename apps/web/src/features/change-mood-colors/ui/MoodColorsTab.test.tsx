// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { createAccountMockTransport, type SetMoodColorRequest } from '@cosimosi/api-client'
import {
  MOODS,
  defaultMoodPalette,
  maxChromaInGamut,
  okLchToColor,
  snapToEmotionStep,
} from '@cosimosi/emotion'

import { defaultLocale, m, moodLabel, setActiveLocale } from '../../../shared/i18n/index.ts'
import { MoodColorsTab } from './MoodColorsTab.tsx'

// The top lightness step near the green arc, at most of the chroma the hue can hold — the one corner
// of the reachable space that trips the glare band (see mood-color-risk.ts). Held back off the gamut
// boundary so an 8-bit round trip does not move it while the test is looking away.
const GLARING = okLchToColor({ l: 0.8, c: maxChromaInGamut(0.8, 145) * 0.9, h: 145 })

afterEach(() => {
  cleanup()
  setActiveLocale(defaultLocale)
})

describe('MoodColorsTab', () => {
  it('shows the colours it has and nothing to edit until one is opened', async () => {
    renderTab()

    for (const mood of MOODS) {
      expect(await screen.findByLabelText(m.palette_swatch_label({ mood: moodLabel(mood) })))
    }
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(m.palette_preset_authored())).toBeNull()
  })

  it('opens one feeling with the authored colour, every rank, and random', async () => {
    renderTab({
      getMoodColorStats: () => ({
        stats: [
          { bucket: 2, swatchColor: '#123456', share: 0.41 },
          { bucket: 5, swatchColor: '#654321', share: 0.19 },
          { bucket: 7, swatchColor: '#abcdef', share: 0.12 },
        ],
      }),
    })
    const user = userEvent.setup()

    await user.click(
      await screen.findByLabelText(m.palette_swatch_label({ mood: moodLabel('JOY') })),
    )

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(m.palette_preset_authored())).toBeTruthy()
    expect(within(dialog).getByText(m.palette_preset_popular_first())).toBeTruthy()
    expect(within(dialog).getByText(m.palette_preset_popular_rank({ rank: '2' }))).toBeTruthy()
    expect(within(dialog).getByText(m.palette_preset_popular_rank({ rank: '3' }))).toBeTruthy()
    expect(within(dialog).getByText(m.palette_preset_random())).toBeTruthy()
    for (const percent of ['41', '19', '12']) {
      expect(within(dialog).getByText(m.palette_preset_share({ percent }))).toBeTruthy()
    }
    // The offer that has no colour yet must not pretend to a ratio.
    expect(within(dialog).getByText(m.palette_preset_random_hint())).toBeTruthy()
  })

  it('gives the authored preset its own share when the aggregate holds its colour', async () => {
    renderTab({
      getMoodColorStats: () => ({
        stats: [
          { bucket: 1, swatchColor: defaultMoodPalette.colors.JOY, share: 0.7 },
          { bucket: 5, swatchColor: '#654321', share: 0.3 },
        ],
      }),
    })
    const user = userEvent.setup()

    await user.click(
      await screen.findByLabelText(m.palette_swatch_label({ mood: moodLabel('JOY') })),
    )

    const dialog = await screen.findByRole('dialog')
    const authored = within(dialog).getByText(m.palette_preset_authored())
    expect(authored.nextElementSibling?.textContent).toBe(m.palette_preset_share({ percent: '70' }))
    // Its bucket fills the authored slot, so it must not also appear as a ranked one.
    expect(within(dialog).queryByText(m.palette_preset_popular_rank({ rank: '2' }))).toBeNull()
  })

  it('gives a single choice its whole share instead of hiding the ratio', async () => {
    renderTab({
      getMoodColorStats: () => ({ stats: [{ bucket: 2, swatchColor: '#123456', share: 1 }] }),
    })
    const user = userEvent.setup()

    await user.click(
      await screen.findByLabelText(m.palette_swatch_label({ mood: moodLabel('JOY') })),
    )

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(m.palette_preset_share({ percent: '100' }))).toBeTruthy()
    expect(within(dialog).queryByText(m.palette_preset_popular_rank({ rank: '2' }))).toBeNull()
  })

  it('shows two equally-chosen buckets in the order the aggregate ranked them', async () => {
    renderTab({
      getMoodColorStats: () => ({
        stats: [
          { bucket: 9, swatchColor: '#654321', share: 0.5 },
          { bucket: 2, swatchColor: '#123456', share: 0.5 },
        ],
      }),
    })
    const user = userEvent.setup()

    await user.click(
      await screen.findByLabelText(m.palette_swatch_label({ mood: moodLabel('JOY') })),
    )

    const dialog = await screen.findByRole('dialog')
    const titles = within(dialog)
      .getAllByText(m.palette_preset_share({ percent: '50' }))
      .map((detail) => detail.previousElementSibling?.textContent)
    expect(titles).toEqual([
      m.palette_preset_popular_first(),
      m.palette_preset_popular_rank({ rank: '2' }),
    ])
  })

  it('keeps a safe colour on one press, with no second surface in the way', async () => {
    const saved: SetMoodColorRequest[] = []
    renderTab({
      setMoodColor: (request) => (
        saved.push(request),
        { mood: request.mood, color: request.color }
      ),
    })
    const user = userEvent.setup()

    await user.click(
      await screen.findByLabelText(m.palette_swatch_label({ mood: moodLabel('SAD') })),
    )
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByText(m.palette_preset_authored()))
    await user.click(within(dialog).getByRole('button', { name: m.palette_save() }))

    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]?.color).toBe(defaultMoodPalette.colors.SAD)
    expect(screen.queryByText(m.palette_confirm_title())).toBeNull()
  })

  it('warns while a risky colour is chosen and asks again before keeping it', async () => {
    const saved: SetMoodColorRequest[] = []
    renderTab({
      getMoodColors: () => ({ colors: [{ mood: 'CALM', color: GLARING }] }),
      setMoodColor: (request) => (
        saved.push(request),
        { mood: request.mood, color: request.color }
      ),
    })
    const user = userEvent.setup()

    await user.click(
      await screen.findByLabelText(m.palette_swatch_label({ mood: moodLabel('CALM') })),
    )
    const dialog = await screen.findByRole('dialog')
    // The notice is standing exposure, not something the save reveals.
    expect(within(dialog).getByText(m.palette_risk_glare())).toBeTruthy()

    await user.click(within(dialog).getByRole('button', { name: m.palette_save() }))
    expect(saved).toHaveLength(0)

    await user.click(await screen.findByRole('button', { name: m.palette_confirm_keep() }))
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]?.color).toBe(snapToEmotionStep(GLARING))
  })
})

function renderTab(handlers: Parameters<typeof createAccountMockTransport>[0] = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <TransportProvider transport={createAccountMockTransport(handlers)}>
      <QueryClientProvider client={queryClient}>
        <MoodColorsTab />
      </QueryClientProvider>
    </TransportProvider>,
  )
  return { queryClient }
}
