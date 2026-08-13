import { moodColor, type Mood } from '@cosimosi/emotion'
import type { Diary } from '@cosimosi/memory'
import { Dialog } from '@cosimosi/ui'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

export interface DemoEntryReaderProps {
  readonly diary: Diary | null
  readonly onClose: () => void
}

// pages/demo ui: one opened diary — the read-only twin of the archive's opened entry
// (`features/read-diary-list`'s `DiaryEntry` inside the reader's modal): the immutable body
// verbatim, then the memories it split into as mood-coloured chips. The product reaches it by
// navigating to the archive; the sandbox has no archive route, so the same body opens as the surface
// it already is on the calendar's day view — a `Dialog` over the universe.
//
// A diary is what was written and a memory is a representation of it ([I2]): the eroded current
// words live on the star's own panel, and nothing here is ever rewritten.
export function DemoEntryReader({ diary, onClose }: DemoEntryReaderProps) {
  if (!diary) return null

  return (
    <Dialog open onClose={onClose} title={diary.diaryDate} closeLabel={m.common_dismiss()}>
      <article className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-text">{diary.body}</p>
        <ul className="flex flex-wrap gap-2">
          {diary.memories.map((member) => (
            <li
              key={member.episodicMemoryId}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: moodColor(member.mood as Mood) }}
              />
              <span className="text-xs text-text" title={moodLabel(member.mood)}>
                {member.name}
              </span>
            </li>
          ))}
        </ul>
      </article>
    </Dialog>
  )
}
