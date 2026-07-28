import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { DiarySort, type GetDiariesInput } from '@cosimosi/api-client'
import { tokens } from '@cosimosi/ui'

import { DeletionFlowSheet } from '../../../widgets/deletion-flow/index.ts'
import { DiaryReaderBlock } from '../../../widgets/diary-reader/index.ts'
import { useScreenInsets } from '../../../shared/native/index.ts'
// The diary-reader page ([D2]) lays out the archive block full-screen. Navigation and focus arrive
// as callback/data props from the app-layer route adapter, so this product page does not depend on
// React Navigation. The deletion flow consumes its shared target only while this page is active.
export function DiaryReaderPage({ active, onExit }: { active: boolean; onExit: () => void }) {
  const insets = useScreenInsets()
  // The archive's conditions are screen-local here: React Native has no address bar, so there is no
  // URL to be the authority the way there is on web ([D7][D8]). The shape is the generated request,
  // so both platforms feed one archive query.
  const [query, setQuery] = useState<GetDiariesInput>({ sort: DiarySort.NEWEST })
  // The view and the displayed month are screen-local for the same reason the conditions are: there is no
  // address bar here to be their authority ([D12]). `month` starts absent so the calendar opens on the
  // month the archive resolves for it rather than on a value this screen guessed.
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [month, setMonth] = useState<string | undefined>(undefined)
  return (
    // The archive's own header clears the device chrome by the live inset — a guessed constant hid
    // the title and the way out behind the status bar.
    <View style={[styles.screen, { paddingTop: insets.top + tokens.spacing[4] }]}>
      <DiaryReaderBlock
        onExit={onExit}
        query={query}
        onQueryChange={(update) => setQuery(update)}
        view={view}
        onViewChange={setView}
        month={month}
        onMonthChange={setMonth}
      />
      {/* Mounted OUTSIDE the view branch, so a full-delete opened from the list survives a switch to the
          calendar and back ([D12]). */}
      <DeletionFlowSheet active={active} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.bg,
    paddingHorizontal: tokens.spacing[4],
  },
})
