import { useEffect, useRef, type ReactNode } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { VALUES } from '@cosimosi/config'
import { moodColor } from '@cosimosi/emotion'
import { diaryMoods, diaryPreview, type Diary, type DiarySplitMember } from '@cosimosi/memory'
import { Button, tokens } from '@cosimosi/ui'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

export interface DiaryListProps {
  diaries: readonly Diary[]
  onOpen: (diaryId: string) => void
  isLoading: boolean
  isError: boolean
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  // Which nothing-to-show this is. Only the composing widget knows whether conditions are active, and
  // it tells the list in two words rather than handing over the conditions themselves ([D10]).
  emptyState: 'archive' | 'no-results'
  onClearConditions?: () => void
  // Rendered above the first row INSIDE the list, so the conditions scroll away with the archive the
  // way they do on web — pinned above a flex:1 list they would leave the rows a sliver of the screen.
  listHeader?: ReactNode
  // Changes whenever the archive's conditions do. A fresh keyset page starts at the top, so the
  // reader should be looking there rather than mid-way down the previous result set ([D7]).
  scrollResetKey?: string
  // Renders a stretch of the diary's own body — the seam the search feature marks its hits through.
  // The list never sees the keyword, so no query can reach a memory's text ([D10]).
  renderBodyText?: (text: string) => ReactNode
}

// features/read-diary-list ui (RN fork, [D2][D6][D7]): the immutable archive as a reverse-chronological
// FlatList. A closed row is date + a bounded preview of the verbatim body + the count of stars born
// from it + its distinct mood dots — no title exists at any layer. A row opens to the whole body
// ([I2][D4]) and its split membership as mood-colored chips ([D3]). Reading, previewing and scrolling
// are free — this surface spends nothing and moves no clock ([D11][T3]). Shares api with web verbatim.
export function DiaryList({
  diaries,
  onOpen,
  isLoading,
  isError,
  hasMore,
  isLoadingMore,
  onLoadMore,
  emptyState,
  onClearConditions,
  listHeader,
  scrollResetKey,
  renderBodyText,
}: DiaryListProps) {
  const listRef = useRef<FlatList<Diary> | null>(null)
  const lastResetKey = useRef(scrollResetKey)
  useEffect(() => {
    // Arriving is not a condition change: only a later key rewinds the list.
    if (lastResetKey.current === scrollResetKey) return
    lastResetKey.current = scrollResetKey
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }, [scrollResetKey])

  if (isLoading) {
    return (
      <View>
        {listHeader}
        <Text style={styles.notice}>{m.diary_reader_loading()}</Text>
      </View>
    )
  }
  if (isError) {
    return (
      <View>
        {listHeader}
        <Text style={styles.notice}>{m.diary_reader_error()}</Text>
      </View>
    )
  }
  if (diaries.length === 0) {
    // An empty archive and a filtered-to-nothing archive are different facts and read differently.
    return emptyState === 'no-results' ? (
      <View style={styles.emptyBlock}>
        {listHeader}
        <Text style={styles.notice}>{m.diary_reader_no_results()}</Text>
        {onClearConditions && (
          <Button color="neutral" size="sm" onPress={onClearConditions}>
            {m.diary_reader_clear_conditions()}
          </Button>
        )}
      </View>
    ) : (
      <View>
        {listHeader}
        <Text style={styles.notice}>{m.diary_reader_empty()}</Text>
      </View>
    )
  }

  return (
    <FlatList
      ref={listRef}
      data={diaries}
      keyExtractor={(diary) => diary.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={listHeader === undefined ? null : <>{listHeader}</>}
      onEndReachedThreshold={VALUES.diaryReader.infiniteScrollEndThreshold}
      // FlatList fires this once per content-length change, and the guard keeps a second page from
      // being asked for while the first is still in flight.
      onEndReached={() => {
        if (hasMore && !isLoadingMore) onLoadMore()
      }}
      renderItem={({ item }) => {
        const preview = diaryPreview(item.body, VALUES.diaryReader.bodyPreviewLength)
        return (
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityHint={m.diary_reader_open_entry_hint()}
              onPress={() => onOpen(item.id)}
              style={styles.header}
            >
              <Text style={styles.date}>{item.diaryDate}</Text>
              <Text style={styles.preview} numberOfLines={2}>
                {renderBodyText ? renderBodyText(preview) : preview}
              </Text>
              <DiaryRowFooter memories={item.memories} />
            </Pressable>
          </View>
        )
      }}
      // Only the FETCH speaks. Reaching the end of the archive announces itself — there are no more
      // rows — and a line saying so under the last one only takes the reader's eye off the writing
      // to tell them what they can already see.
      ListFooterComponent={
        isLoadingMore ? (
          <Text style={styles.footerNote}>{m.diary_reader_loading_more()}</Text>
        ) : null
      }
    />
  )
}

// The row's recognition line: how many stars this entry launched, and which feelings they carry.
function DiaryRowFooter({ memories }: { memories: readonly DiarySplitMember[] }) {
  const moods = diaryMoods(memories)
  const shown = moods.slice(0, VALUES.diaryReader.rowMoodDotMax)
  const remainder = moods.length - shown.length
  const spoken =
    moods.length > 0
      ? `${m.diary_reader_star_count({ count: memories.length })}. ${m.diary_reader_mood_list({
          moods: moods.map(moodLabel).join(', '),
        })}`
      : m.diary_reader_star_count({ count: memories.length })
  return (
    // One accessibility element for the whole line, so the count and the feelings are announced
    // together and the colour swatches are not read as unnamed views. `accessible` is what makes the
    // label reachable on iOS; without it the label exists on a view the reader never visits.
    <View style={styles.footerLine} accessible accessibilityLabel={spoken}>
      <Text style={styles.count}>{m.diary_reader_star_count({ count: memories.length })}</Text>
      {shown.map((mood) => (
        <View
          key={mood}
          accessible={false}
          importantForAccessibility="no"
          style={[styles.dot, { backgroundColor: moodColor(mood) }]}
        />
      ))}
      {remainder > 0 && (
        <Text accessible={false} importantForAccessibility="no" style={styles.count}>
          {m.diary_reader_mood_more({ count: remainder })}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  notice: {
    color: tokens.color['text-muted'],
    fontSize: tokens.fontSize.sm,
    padding: tokens.spacing[6],
  },
  emptyBlock: { alignItems: 'flex-start', gap: tokens.spacing[2], padding: tokens.spacing[2] },
  list: { gap: tokens.spacing[2], paddingBottom: tokens.spacing[8] },
  row: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  header: {
    gap: tokens.spacing[1],
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
  },
  date: { color: tokens.color.text, fontSize: tokens.fontSize.sm, fontWeight: '500' },
  preview: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  dot: { width: 8, height: 8, borderRadius: tokens.radius.sm },
  footerLine: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[1] },
  count: { color: tokens.color['text-subtle'], fontSize: tokens.fontSize.xs },
  footerNote: {
    color: tokens.color['text-subtle'],
    fontSize: tokens.fontSize.sm,
    paddingVertical: tokens.spacing[2],
    textAlign: 'center',
  },
})
