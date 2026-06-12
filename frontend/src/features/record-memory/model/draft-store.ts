// Compose-draft + review state + submit status (spec 10, reshaped by 21).
// body/entryDate/fragments live ONLY here (draft) — they are never put in the
// render store (constitution §1: the immutable original is records; the star
// carries no body/date — Architecture §2.7).
//
// The flow is two-phase: compose(본문 작성) → "별로 분해" → review(조각·감정
// 확인/수정/추가) → "별 띄우기". The AI's split is therefore never persisted
// unseen — the user confirms every fragment before it becomes a star.
import { create } from 'zustand'
import { Mood } from '@/shared/api'
import { MAX_FRAGMENTS, type DraftFragment } from '../api/record-memory'

export type SubmitStatus = 'idle' | 'segmenting' | 'submitting' | 'error'
export type DraftPhase = 'compose' | 'review'

/** Today as YYYY-MM-DD in local time (acceptance 1.5 default). */
function todayLocal(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** 수동 추가 조각의 기본값 — 중립/중간 강도에서 사용자가 다듬는다. */
function emptyFragment(): DraftFragment {
  return { id: crypto.randomUUID(), text: '', mood: Mood.NEUTRAL, intensity: 0.5, valence: 0 }
}

interface DraftState {
  body: string
  entryDate: string
  phase: DraftPhase
  /** 검토 중인 조각들 — AI 제안 + 사용자의 수정/추가. review 단계에서만 의미. */
  fragments: DraftFragment[]
  /** Idempotency nonce, stable for THIS draft's lifetime: a failed submit
   *  retried by the user reuses the same key (server dedups); only a successful
   *  reset() rolls it for the next diary. */
  submitNonce: string
  status: SubmitStatus
  errorText: string
  setBody: (v: string) => void
  setEntryDate: (v: string) => void
  setStatus: (s: SubmitStatus) => void
  setError: (text: string) => void
  /** 분해 결과 도착 → 검토 단계로 전환. */
  setFragments: (fragments: DraftFragment[]) => void
  updateFragment: (id: string, patch: Partial<Omit<DraftFragment, 'id'>>) => void
  /** 빈 조각 한 장 추가(상한 MAX_FRAGMENTS — 초과 시 no-op). */
  addFragment: () => void
  removeFragment: (id: string) => void
  /** 검토 → 본문으로 복귀. 조각은 버린다(본문이 바뀔 수 있으니 재분해가 출처). */
  backToCompose: () => void
  reset: () => void
}

export const useDraftStore = create<DraftState>((set) => ({
  body: '',
  entryDate: todayLocal(),
  phase: 'compose',
  fragments: [],
  submitNonce: crypto.randomUUID(),
  status: 'idle',
  errorText: '',
  setBody: (body) => set({ body }),
  setEntryDate: (entryDate) => set({ entryDate }),
  setStatus: (status) => set({ status }),
  setError: (errorText) => set({ status: 'error', errorText }),
  setFragments: (fragments) => set({ fragments, phase: 'review', status: 'idle', errorText: '' }),
  // 조각 변경은 모두 nonce를 새로 굴린다: 제출이 커밋됐는데 응답만 유실된 뒤(에러 표시)
  // 조각을 고쳐 재제출하면, 같은 키로는 서버가 옛 커밋을 idempotent 반환해 수정이
  // 조용히 증발한다 — 내용이 달라졌으면 다른 키가 맞다(순수 재시도는 키 유지).
  updateFragment: (id, patch) =>
    set((s) => ({
      fragments: s.fragments.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      submitNonce: crypto.randomUUID(),
    })),
  addFragment: () =>
    set((s) =>
      s.fragments.length >= MAX_FRAGMENTS
        ? s
        : { fragments: [...s.fragments, emptyFragment()], submitNonce: crypto.randomUUID() },
    ),
  removeFragment: (id) =>
    set((s) => ({
      fragments: s.fragments.filter((f) => f.id !== id),
      submitNonce: crypto.randomUUID(),
    })),
  backToCompose: () => set({ phase: 'compose', fragments: [], status: 'idle', errorText: '' }),
  reset: () =>
    set({
      body: '',
      phase: 'compose',
      fragments: [],
      status: 'idle',
      errorText: '',
      entryDate: todayLocal(),
      submitNonce: crypto.randomUUID(),
    }),
}))
