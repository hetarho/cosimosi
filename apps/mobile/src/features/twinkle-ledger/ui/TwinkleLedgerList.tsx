import { StyleSheet, Text, View } from 'react-native'

import { groupLedgerByDay } from '@cosimosi/twinkle'
import { useTwinkleLedgerInfiniteQuery } from '@cosimosi/twinkle/react'
import { Button, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import { LedgerEntryRow } from './LedgerEntryRow.tsx'
import { TwinkleRefillMarker } from './TwinkleRefillMarker.tsx'

// The history: newest first, grouped under day headers, keyset-paged.
//
// The day headers come from the server-supplied `occurredOn`, already resolved in the user's timezone.
// The client performs no timezone arithmetic ([U7]): a device-local grouping would draw headers that
// disagree with the SMALL reset boundary the same reader just watched refill.
//
// The next page is an EXPLICIT affordance here, where web auto-loads on a sentinel. The tab is composed
// inside the /me page's own ScrollView, so a FlatList placed here cannot scroll — and `onEndReached` is
// driven by scroll, so it would never fire. A nested scroller inside a scrolling page is the worse fix:
// it traps the gesture and hides the page's remaining content. A tap that says what it does is honest;
// a listener that never fires is not.
export function TwinkleLedgerList() {
  const query = useTwinkleLedgerInfiniteQuery()
  const entries = query.data?.pages.flatMap((page) => page.entries) ?? []
  const days = groupLedgerByDay(entries)

  return (
    <View style={styles.history}>
      <Text style={styles.heading}>{m.me_stardust_history_title()}</Text>
      {/* The refill is stated before the history, always — an account with no rows at all still has
          today's 작은 별가루, so this surface is never bare ([G5]). */}
      <TwinkleRefillMarker />
      {days.map((day) => (
        <View key={`${day.occurredOn}-${day.entries[0]?.id ?? ''}`} style={styles.day}>
          <Text style={styles.dayHeader}>{day.occurredOn}</Text>
          {day.entries.map((entry) => (
            <LedgerEntryRow key={entry.id} entry={entry} />
          ))}
        </View>
      ))}
      {query.isPending ? <Text style={styles.muted}>{m.me_stardust_history_loading()}</Text> : null}
      {/* A failed read is NOT an empty history. Saying "nothing has come or gone" when the request
          broke would tell the reader their record is gone, which is the one thing it never is ([I1]). */}
      {query.isError ? <Text style={styles.muted}>{m.me_stardust_history_error()}</Text> : null}
      {!query.isPending && !query.isError && entries.length === 0 ? (
        <Text style={styles.muted}>{m.me_stardust_history_empty()}</Text>
      ) : null}
      {query.hasNextPage ? (
        <View style={styles.more}>
          <Button
            color="neutral"
            size="sm"
            loading={query.isFetchingNextPage}
            disabled={query.isFetchingNextPage}
            onPress={() => {
              query.fetchNextPage().catch(() => undefined)
            }}
          >
            {m.me_stardust_history_more()}
          </Button>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  history: { gap: tokens.spacing[3] },
  heading: { color: tokens.color.text, fontSize: tokens.fontSize.sm, fontWeight: '500' },
  day: { gap: tokens.spacing[1] },
  dayHeader: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  more: { flexDirection: 'row', justifyContent: 'center' },
})
