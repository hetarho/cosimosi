import { type ReactNode } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { moodColor, type Mood } from '@cosimosi/emotion'
import { Button, tokens } from '@cosimosi/ui'

import type { Diary, DiarySplitMember } from '../../../entities/diary/index.ts'
import { m, moodLabel } from '../../../shared/i18n/index.ts'

export interface DiaryListProps {
  diaries: readonly Diary[]
  openedDiaryId: string | null
  onOpen: (diaryId: string) => void
  onClose: () => void
  isLoading: boolean
  isError: boolean
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  // The opened entry's spend affordance is injected by the composing widget (the jump is a paid
  // action this free read feature must not own); nothing renders for a diary with no live star.
  renderActions?: (diary: Diary) => ReactNode
}

// features/read-diary-list ui (RN fork, [D2]): the immutable archive as a reverse-chronological
// FlatList. A row opens to the diary's verbatim body ([I2][D4]) and its split membership as
// mood-colored chips ([D3]); an all-let-go diary opens with no chips and a quiet note. Reading
// opens/reads freely — this surface spends nothing and moves no clock. Shares api with web verbatim.
export function DiaryList({
  diaries,
  openedDiaryId,
  onOpen,
  onClose,
  isLoading,
  isError,
  hasMore,
  isLoadingMore,
  onLoadMore,
  renderActions,
}: DiaryListProps) {
  if (isLoading) {
    return <Text style={styles.notice}>{m.diary_reader_loading()}</Text>
  }
  if (isError) {
    return <Text style={styles.notice}>{m.diary_reader_error()}</Text>
  }
  if (diaries.length === 0) {
    return <Text style={styles.notice}>{m.diary_reader_empty()}</Text>
  }

  return (
    <FlatList
      data={diaries}
      keyExtractor={(diary) => diary.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const opened = item.id === openedDiaryId
        return (
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: opened }}
              onPress={() => (opened ? onClose() : onOpen(item.id))}
              style={styles.header}
            >
              <Text style={styles.date}>{item.diaryDate}</Text>
              {!opened && (
                <Text style={styles.preview} numberOfLines={1}>
                  {item.body}
                </Text>
              )}
            </Pressable>
            {opened && (
              <View style={styles.opened}>
                <Text style={styles.body}>{item.body}</Text>
                {item.memories.length > 0 ? (
                  <DiaryChips members={item.memories} />
                ) : (
                  <Text style={styles.muted}>{m.diary_reader_all_let_go()}</Text>
                )}
                {renderActions?.(item)}
              </View>
            )}
          </View>
        )
      }}
      ListFooterComponent={
        hasMore ? (
          <View style={styles.footer}>
            <Button color="neutral" size="sm" onPress={onLoadMore} disabled={isLoadingMore}>
              {m.diary_reader_load_more()}
            </Button>
          </View>
        ) : null
      }
    />
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
  notice: {
    color: tokens.color['text-muted'],
    fontSize: tokens.fontSize.sm,
    padding: tokens.spacing[6],
  },
  list: { gap: tokens.spacing[2], paddingBottom: tokens.spacing[8] },
  row: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 8,
    backgroundColor: tokens.color.surface,
  },
  header: {
    gap: tokens.spacing[1],
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
  },
  date: { color: tokens.color.text, fontSize: tokens.fontSize.sm, fontWeight: '500' },
  preview: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  opened: {
    gap: tokens.spacing[4],
    paddingHorizontal: tokens.spacing[4],
    paddingBottom: tokens.spacing[4],
  },
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
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: tokens.color.text, fontSize: tokens.fontSize.xs },
  footer: { alignItems: 'center', paddingVertical: tokens.spacing[2] },
})
