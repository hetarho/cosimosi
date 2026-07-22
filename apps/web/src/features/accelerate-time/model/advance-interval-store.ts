import { create } from 'zustand'

import { mergeAdvanceAnnouncements, type AdvanceAnnouncement } from '@cosimosi/universe'

// The launch → acceleration seam (§3.2 data, module-level so it survives the write sheet
// unmounting — the launched-neurons-store precedent): the write flow announces the returned
// advance interval + the deferred reveal ids; the mounted universe-time overlay takes and plays
// it. Back-to-back announces merge into one sweep (earliest previous → latest current, reveal
// union — mergeAdvanceAnnouncements) so an announce landing mid-play is queued, never dropped and
// never inverted.
export interface AdvanceAnnouncementState {
  pending: AdvanceAnnouncement | null
  announce: (announcement: AdvanceAnnouncement) => void
  take: () => AdvanceAnnouncement | null
  reset: () => void
}

export const useAdvanceAnnouncementStore = create<AdvanceAnnouncementState>()((set, get) => ({
  pending: null,
  announce: (announcement) =>
    set(({ pending }) => ({
      pending: pending ? mergeAdvanceAnnouncements(pending, announcement) : announcement,
    })),
  take: () => {
    const { pending } = get()
    if (pending) set({ pending: null })
    return pending
  },
  reset: () => set({ pending: null }),
}))
