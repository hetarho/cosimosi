import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { moodColor, type Mood } from '@cosimosi/emotion'
import type { Diary, DiarySplitMember } from '@cosimosi/memory'
import { tokens } from '@cosimosi/ui'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

export interface DiaryEntryProps {
  diary: Diary
  /** Renders a stretch of the diary's own body — the seam the search feature marks its hits
   *  through. This component never sees the keyword, so no query can reach a memory's text ([D10]). */
  renderBodyText?: (text: string) => ReactNode
  /** The composing widget's controls for this entry. A free read owns no action of its own. */
  actions?: ReactNode
}

// features/read-diary-list ui (RN fork, [D4][I2][D3]): one opened diary — the immutable body
// verbatim, the 2–5 episodic memories it split into as mood-coloured chips, and a slot the composing
// widget fills. It is the single body BOTH surfaces that open an entry compose: the per-diary modal
// and the calendar's day modal. Reading it is free; nothing here quotes, spends, or moves the clock.
export function DiaryEntry({ diary, renderBodyText, actions }: DiaryEntryProps) {
  return (
    <View style={styles.entry}>
      <Text style={styles.body}>{renderBodyText ? renderBodyText(diary.body) : diary.body}</Text>
      {diary.memories.length > 0 ? (
        <DiaryChips members={diary.memories} />
      ) : (
        <Text style={styles.muted}>{m.diary_reader_all_let_go()}</Text>
      )}
      {actions}
    </View>
  )
}

function DiaryChips({ members }: { members: readonly DiarySplitMember[] }) {
  return (
    <View style={styles.chips}>
      {members.map((member) => (
        <View
          key={member.episodicMemoryId}
          style={styles.chip}
          accessibilityLabel={moodLabel(member.mood)}
        >
          <View style={[styles.dot, { backgroundColor: moodColor(member.mood as Mood) }]} />
          <Text style={styles.chipText}>{member.name}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  entry: { gap: tokens.spacing[4] },
  body: { color: tokens.color.text, fontSize: tokens.fontSize.sm, lineHeight: 22 },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.spacing[4],
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: tokens.spacing[1],
  },
  dot: { width: 8, height: 8, borderRadius: tokens.radius.sm },
  chipText: { color: tokens.color.text, fontSize: tokens.fontSize.xs },
})
