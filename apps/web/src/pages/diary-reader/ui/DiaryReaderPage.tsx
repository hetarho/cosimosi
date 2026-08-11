import type { GetDiariesInput } from '@cosimosi/api-client'
import type { DiaryConditionsUpdate } from '@cosimosi/universe/react'

import { DeletionFlowSheet } from '../../../widgets/deletion-flow/index.ts'
import { DiaryReaderBlock } from '../../../widgets/diary-reader/index.ts'

// The diary-reader screen (`/diary`, [D2]): the quiet keeping-place — the immutable archive read
// full-height, scrollable. The page only lays out; the widget owns the read, the jump, and the
// hand-off back to the universe through the `onExit` seam the app-layer route supplies. The
// deletion flow is mounted here too so a per-entry full-delete opens over the reader.
export function DiaryReaderPage({
  onExit,
  query,
  onQueryChange,
  view,
  onViewChange,
  month,
  onMonthChange,
}: {
  onExit: () => void
  query: GetDiariesInput
  onQueryChange: (update: DiaryConditionsUpdate) => void
  view: 'list' | 'calendar'
  onViewChange: (view: 'list' | 'calendar') => void
  month?: string
  onMonthChange: (month: string) => void
}) {
  return (
    <main className="min-h-dvh overflow-y-auto bg-bg text-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <DiaryReaderBlock
          onExit={onExit}
          query={query}
          onQueryChange={onQueryChange}
          view={view}
          onViewChange={onViewChange}
          month={month}
          onMonthChange={onMonthChange}
        />
      </div>
      {/* Mounted OUTSIDE the view branch, so a full-delete opened from the list survives a switch to the
          calendar and back ([D12]). */}
      <DeletionFlowSheet />
    </main>
  )
}
