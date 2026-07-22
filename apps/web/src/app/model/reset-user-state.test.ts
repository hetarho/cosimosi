import { describe, expect, it } from 'vitest'

import { DEFAULT_PALETTE_ID } from '@cosimosi/emotion'

import { useAdvanceAnnouncementStore } from '../../features/accelerate-time/index.ts'
import { usePalettePreferenceStore } from '../../features/change-palette/index.ts'
import {
  requestTimeSyncConsent,
  useTimeSyncConsentStore,
} from '../../features/confirm-time-sync/index.ts'
import { useLaunchedNeuronsStore } from '../../features/launch-stars/index.ts'
import { useDiaryDraftStore } from '../../features/write-diary/index.ts'
import { useDeletionDraftStore } from '../../widgets/deletion-flow/index.ts'
import { useRecallDraftStore } from '../../widgets/recall-flow/index.ts'
import { useProposalStore } from '../../widgets/writing-flow/index.ts'
import { resetWebUserState } from './reset-user-state.ts'

describe('resetWebUserState', () => {
  it('clears every app-owned draft/channel and settles pending consent', async () => {
    useAdvanceAnnouncementStore.setState({ pending: {} as never })
    useLaunchedNeuronsStore.setState({ newNeuronIds: ['neuron-a'] })
    useDiaryDraftStore.setState({ body: 'user A diary', diaryDate: '2026-07-22' })
    useProposalStore.setState({ memories: [{} as never] })
    useRecallDraftStore.setState({ rewrite: 'user A recall', result: {} as never })
    useDeletionDraftStore.setState({
      phrase: 'user A deletion',
      candidates: [{} as never],
      selectedNeuronIds: ['neuron-a'],
      heavyDetected: true,
    })
    usePalettePreferenceStore.setState({
      paletteId: 'muted-dusk',
      confirmedPaletteId: 'muted-dusk',
    })
    const consent = requestTimeSyncConsent()

    resetWebUserState('user-b')

    await expect(consent).resolves.toBe('cancel')
    expect(useAdvanceAnnouncementStore.getState().pending).toBeNull()
    expect(useLaunchedNeuronsStore.getState().newNeuronIds).toEqual([])
    expect(useDiaryDraftStore.getState()).toMatchObject({ body: '', diaryDate: '' })
    expect(useProposalStore.getState().memories).toEqual([])
    expect(useRecallDraftStore.getState()).toMatchObject({ rewrite: '', result: null })
    expect(useDeletionDraftStore.getState()).toMatchObject({
      phrase: '',
      candidates: [],
      selectedNeuronIds: [],
      heavyDetected: false,
    })
    expect(useTimeSyncConsentStore.getState().pending).toBeNull()
    expect(usePalettePreferenceStore.getState()).toMatchObject({
      paletteId: DEFAULT_PALETTE_ID,
      confirmedPaletteId: DEFAULT_PALETTE_ID,
    })
  })
})
