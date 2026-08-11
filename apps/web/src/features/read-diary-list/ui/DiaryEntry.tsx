import type { ReactNode } from 'react'

import { moodColor, type Mood } from '@cosimosi/emotion'
import type { Diary, DiarySplitMember } from '@cosimosi/memory'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

export interface DiaryEntryProps {
  diary: Diary
  /** Renders a stretch of the diary's own body — the seam the search feature marks its hits
   *  through. This component never sees the keyword, so no query can reach a memory's text ([D10]). */
  renderBodyText?: (text: string) => ReactNode
  /** The composing widget's controls for this entry. A free read owns no action of its own. */
  actions?: ReactNode
}

// features/read-diary-list ui ([D4][I2][D3]): one opened diary — the immutable body verbatim, the
// 2–5 episodic memories it split into as mood-coloured chips, and a slot the composing widget fills.
// It is the single body BOTH surfaces that open an entry compose: the per-diary modal and the
// calendar's day modal. Reading it is free; nothing here quotes, spends, or moves the clock.
export function DiaryEntry({ diary, renderBodyText, actions }: DiaryEntryProps) {
  return (
    <article className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-text">
        {renderBodyText ? renderBodyText(diary.body) : diary.body}
      </p>
      {diary.memories.length > 0 ? (
        <DiaryChips members={diary.memories} />
      ) : (
        <p className="text-sm text-text-muted">{m.diary_reader_all_let_go()}</p>
      )}
      {actions}
    </article>
  )
}

function DiaryChips({ members }: { members: readonly DiarySplitMember[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {members.map((member) => (
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
  )
}
