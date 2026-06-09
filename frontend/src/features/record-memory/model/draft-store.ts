// Compose-draft + submit status (spec 10). body/entryDate live ONLY here (draft) —
// they are never put in the render store (constitution §1: the immutable original
// is records; the star carries no body/date — Architecture §2.7).
import { create } from 'zustand'
import { Mood } from '@/shared/api'

export type SubmitStatus = 'idle' | 'submitting' | 'error'

/** Today as YYYY-MM-DD in local time (acceptance 1.5 default). */
function todayLocal(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

interface DraftState {
  body: string
  mood: Mood
  intensity: number
  entryDate: string
  status: SubmitStatus
  errorText: string
  setBody: (v: string) => void
  setMood: (v: Mood) => void
  setIntensity: (v: number) => void
  setEntryDate: (v: string) => void
  setStatus: (s: SubmitStatus) => void
  setError: (text: string) => void
  reset: () => void
}

export const useDraftStore = create<DraftState>((set) => ({
  body: '',
  mood: Mood.JOY,
  intensity: 0.7,
  entryDate: todayLocal(),
  status: 'idle',
  errorText: '',
  setBody: (body) => set({ body }),
  setMood: (mood) => set({ mood }),
  setIntensity: (intensity) => set({ intensity }),
  setEntryDate: (entryDate) => set({ entryDate }),
  setStatus: (status) => set({ status }),
  setError: (errorText) => set({ status: 'error', errorText }),
  reset: () => set({ body: '', status: 'idle', errorText: '', entryDate: todayLocal() }),
}))
