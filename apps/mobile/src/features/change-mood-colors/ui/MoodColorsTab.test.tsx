import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { TransportProvider } from '@connectrpc/connect-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { createAccountMockTransport, type SetMoodColorRequest } from '@cosimosi/api-client'
import {
  defaultMoodPalette,
  maxChromaInGamut,
  okLchToColor,
  snapToEmotionStep,
} from '@cosimosi/emotion'
import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'
import { Alert } from '@cosimosi/ui'

import { m, moodLabel } from '../../../shared/i18n/index.ts'
import { MoodColorsTab } from './MoodColorsTab.tsx'

const GLARING = okLchToColor({ l: 0.8, c: maxChromaInGamut(0.8, 145) * 0.9, h: 145 })
const queryClients: QueryClient[] = []

afterEach(() => {
  for (const client of queryClients.splice(0)) client.clear()
  setActiveLocale(defaultLocale)
})

describe('MoodColorsTab (mobile)', () => {
  it('keeps a safe colour on one press and names the preset by its visible title', async () => {
    const saved: SetMoodColorRequest[] = []
    const view = renderTab({
      setMoodColor: (request) => {
        saved.push(request)
        return { mood: request.mood, color: request.color }
      },
    })

    await openMood(view, 'SAD')
    const authored = await view.findByLabelText(m.palette_preset_authored())
    expect(authored.props.accessibilityHint).toBe(m.palette_preset_label())
    fireEvent.press(authored)
    fireEvent.press(view.getByText(m.palette_save()))

    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]?.color).toBe(defaultMoodPalette.colors.SAD)
    expect(view.queryByText(m.palette_confirm_title())).toBeNull()
  })

  it('warns politely while a risky colour is chosen and asks again before keeping it', async () => {
    const saved: SetMoodColorRequest[] = []
    const view = renderTab({
      getMoodColors: () => ({ colors: [{ mood: 'CALM', color: GLARING }] }),
      setMoodColor: (request) => {
        saved.push(request)
        return { mood: request.mood, color: request.color }
      },
    })

    await openMood(view, 'CALM')
    expect(view.getByText(m.palette_risk_glare())).toBeTruthy()
    expect(view.UNSAFE_getByType(Alert).props).toMatchObject({ variant: 'warning', live: 'status' })

    fireEvent.press(view.getByText(m.palette_save()))
    expect(saved).toHaveLength(0)
    fireEvent.press(await view.findByText(m.palette_confirm_keep()))

    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]?.color).toBe(snapToEmotionStep(GLARING))
  })

  it('keeps a failed save visible and editable inside the open dialog', async () => {
    const view = renderTab({
      setMoodColor: () => {
        throw new Error('refused')
      },
    })

    await openMood(view, 'SAD')
    fireEvent.press(view.getByText(m.palette_save()))

    const failure = await view.findByText(m.palette_save_failed())
    expect(failure).toBeTruthy()
    expect(view.UNSAFE_getByType(Alert).props).toMatchObject({ variant: 'danger' })
    const hue = view.getByLabelText(`${m.palette_picker_hue()} 0°`)
    expect(hue.props.accessibilityState.disabled).toBe(false)
    fireEvent.press(hue)
    expect(view.getByText(m.palette_dialog_title({ mood: moodLabel('SAD') }))).toBeTruthy()

    fireEvent.press(view.getByText(m.common_cancel()))
    expect(view.getByText(m.palette_save_failed())).toBeTruthy()
  })
})

function renderTab(handlers: Parameters<typeof createAccountMockTransport>[0] = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  })
  queryClients.push(queryClient)
  return render(
    <TransportProvider transport={createAccountMockTransport(handlers)}>
      <QueryClientProvider client={queryClient}>
        <MoodColorsTab />
      </QueryClientProvider>
    </TransportProvider>,
  )
}

async function openMood(view: ReturnType<typeof renderTab>, mood: Parameters<typeof moodLabel>[0]) {
  const label = m.palette_swatch_label({ mood: moodLabel(mood) })
  await waitFor(() =>
    expect(view.getByLabelText(label).props.accessibilityState.disabled).toBe(false),
  )
  fireEvent.press(view.getByLabelText(label))
  await view.findByText(m.palette_dialog_title({ mood: moodLabel(mood) }))
}
