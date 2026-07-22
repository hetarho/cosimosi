import { useCallback } from 'react'

import type { Transport } from '@connectrpc/connect'
import { useTransport } from '@connectrpc/connect-query'

import { setPalettePreference } from '@cosimosi/api-client'
import { DEFAULT_PALETTE_ID, resolvePaletteById } from '@cosimosi/emotion'

import { usePalettePreferenceStore } from '../model/palette-preference-store.ts'
import { applyConfirmedPalette, applyPalette } from './apply-palette.ts'

interface PalettePersistenceSession {
  readonly scopeKey: string
  readonly epoch: number
  tail: Promise<void>
  latestIntent: number
}

let nextEpoch = 0
let persistenceSession = createPersistenceSession('unscoped')

export class PaletteSessionChangedError extends Error {
  constructor() {
    super('Palette persistence was cancelled because the authenticated session changed')
    this.name = 'PaletteSessionChangedError'
  }
}

function createPersistenceSession(scopeKey: string): PalettePersistenceSession {
  return { scopeKey, epoch: ++nextEpoch, tail: Promise.resolve(), latestIntent: 0 }
}

function isCurrentSession(session: PalettePersistenceSession): boolean {
  return persistenceSession === session && persistenceSession.epoch === session.epoch
}

export function resetPaletteSession(scopeKey: string): void {
  persistenceSession = createPersistenceSession(scopeKey)
  applyConfirmedPalette(DEFAULT_PALETTE_ID)
}

export function initializePaletteSession(scopeKey: string, confirmedId: string): void {
  if (persistenceSession.scopeKey !== scopeKey) {
    persistenceSession = createPersistenceSession(scopeKey)
  }
  applyConfirmedPalette(confirmedId)
}

export function paletteSessionMatches(scopeKey: string, confirmedId: string): boolean {
  const resolved = resolvePaletteById(confirmedId)
  const state = usePalettePreferenceStore.getState()
  return persistenceSession.scopeKey === scopeKey && state.confirmedPaletteId === resolved.id
}

export async function changePalette(
  transport: Transport,
  id: string,
  scopeKey: string,
): Promise<void> {
  const session = persistenceSession
  if (session.scopeKey !== scopeKey) throw new PaletteSessionChangedError()

  const intent = ++session.latestIntent
  const canonicalIntentId = applyPalette(id)
  const send = session.tail.then(async () => {
    if (!isCurrentSession(session)) throw new PaletteSessionChangedError()
    return setPalettePreference(transport, canonicalIntentId)
  })
  session.tail = send.then(
    () => undefined,
    () => undefined,
  )

  try {
    const saved = await send
    if (!isCurrentSession(session)) throw new PaletteSessionChangedError()

    const canonicalSavedId = resolvePaletteById(saved.paletteId).id
    usePalettePreferenceStore.getState().setConfirmedPaletteId(canonicalSavedId)
    if (session.latestIntent === intent) applyPalette(canonicalSavedId)
  } catch (error) {
    if (!isCurrentSession(session)) throw new PaletteSessionChangedError()
    if (session.latestIntent === intent) {
      applyPalette(usePalettePreferenceStore.getState().confirmedPaletteId)
    }
    throw error
  }
}

export function useChangePalette(): (id: string) => Promise<void> {
  const transport = useTransport()
  const scopeKey = persistenceSession.scopeKey
  return useCallback((id: string) => changePalette(transport, id, scopeKey), [transport, scopeKey])
}
