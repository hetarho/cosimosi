// Compose-draft + submit status (spec 10, reshaped by 21). body/entryDate live
// ONLY here (draft) — they are never put in the render store (constitution §1:
// the immutable original is records; the star carries no body/date — Architecture
// §2.7). Since spec 21 the AI detects per-fragment emotion, so mood/intensity are
// an OPTIONAL manual hint behind a collapsed toggle (manualMood) — sent only when
// the user opted in, and even then used server-side as a fallback.
import { create } from 'zustand'
import { Mood } from '@/shared/api'

export type SubmitStatus = 'idle' | 'submitting' | 'segmenting' | 'error'

/** Today as YYYY-MM-DD in local time (acceptance 1.5 default). */
function todayLocal(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

interface DraftState {
  body: string
  /** Manual-emotion fallback toggle (spec 21, 1.6) — off by default: the AI
   *  detects each fragment's emotion; mood/intensity are sent only when on. */
  manualMood: boolean
  mood: Mood
  intensity: number
  entryDate: string
  /** Idempotency nonce, stable for THIS draft's lifetime: a failed submit
   *  retried by the user reuses the same key (server dedups); only a successful
   *  reset() rolls it for the next diary. */
  submitNonce: string
  status: SubmitStatus
  errorText: string
  setBody: (v: string) => void
  setManualMood: (v: boolean) => void
  setMood: (v: Mood) => void
  setIntensity: (v: number) => void
  setEntryDate: (v: string) => void
  setStatus: (s: SubmitStatus) => void
  setError: (text: string) => void
  reset: () => void
}

export const useDraftStore = create<DraftState>((set) => ({
  body: '',
  manualMood: false,
  mood: Mood.JOY,
  intensity: 0.7,
  entryDate: todayLocal(),
  submitNonce: crypto.randomUUID(),
  status: 'idle',
  errorText: '',
  setBody: (body) => set({ body }),
  setManualMood: (manualMood) => set({ manualMood }),
  setMood: (mood) => set({ mood }),
  setIntensity: (intensity) => set({ intensity }),
  setEntryDate: (entryDate) => set({ entryDate }),
  setStatus: (status) => set({ status }),
  setError: (errorText) => set({ status: 'error', errorText }),
  reset: () =>
    set({
      body: '',
      status: 'idle',
      errorText: '',
      entryDate: todayLocal(),
      submitNonce: crypto.randomUUID(),
    }),
}))
