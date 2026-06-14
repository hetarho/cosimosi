// Wayfinding navigation state (spec 28) — the model behind "원본 일기로 별 찾기": which diary's
// stars are highlighted, and a pending request to frame them all. Pure (zustand only — no
// three/React/DOM, 헌법4 / acceptance 1.10): the universe-canvas widget READS this store to
// drive the camera (FrameAllController) and to derive the highlighted star set it passes to
// StarField — features can't reach the widget's camera store, and the entity StarField can't
// read a feature store, so the widget (above both layers) is the single composition point.
//
// Everything keys on recordId (the Star.record_id group key): framing a diary also highlights
// it, so one action carries both. The widget resolves recordId → the live star coords itself
// (starsOfRecord + the force-sim buffer), keeping coordinates a client read (헌법3).
import { create } from 'zustand'

interface WayfindingState {
  /** The diary whose stars are highlighted (boosted; others dim), or null. */
  highlightedRecordId: string | null
  /** A pending frame-all request, bumped each time so re-framing the SAME diary re-fires.
   *  The controller tracks the nonce locally and consumes it (no store write needed). */
  frameRequest: { recordId: string; nonce: number } | null
  /** Monotonic request counter — the source of frameRequest.nonce. It MUST survive clear()
   *  (which nulls frameRequest): if the nonce derived from frameRequest?.nonce, after a clear
   *  the next request would reset to 1 and the controller — comparing against its last-seen
   *  nonce — would ignore it (framing a 2nd diary after closing the sheet once would silently
   *  no-op). Keeping the seq on the store makes the nonce strictly increasing across clears. */
  seq: number
  /** Frame + highlight one diary's stars in the FAR (조망) view. The controller enforces the
   *  near/far guard (recall→nebula first; near=단일 엔그램만, acceptance 1.4) before framing. */
  frameRecord: (recordId: string) => void
  /** Clear the highlight (and any pending frame) — closing the diary panel, or focusing a
   *  single star. Visual-only state; never touches records/memories (헌법1·2). `seq` is NOT
   *  reset (see above). */
  clear: () => void
}

export const useWayfindingStore = create<WayfindingState>((set) => ({
  highlightedRecordId: null,
  frameRequest: null,
  seq: 0,
  frameRecord: (recordId) =>
    set((s) => {
      const nonce = s.seq + 1
      return { highlightedRecordId: recordId, frameRequest: { recordId, nonce }, seq: nonce }
    }),
  clear: () => set({ highlightedRecordId: null, frameRequest: null }),
}))
