import { DiaryReaderBlock } from '../../../widgets/diary-reader/index.ts'

// The diary-reader screen (`/diary`, [D2]): the quiet keeping-place — the immutable archive read
// full-height, scrollable. The page only lays out; the widget owns the read, the jump, and the
// hand-off back to the universe through the `onExit` seam the app-layer route supplies.
export function DiaryReaderPage({ onExit }: { onExit: () => void }) {
  return (
    <main className="min-h-dvh overflow-y-auto bg-background text-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <DiaryReaderBlock onExit={onExit} />
      </div>
    </main>
  )
}
