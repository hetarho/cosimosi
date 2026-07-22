import { StyleSheet, View } from 'react-native'

import { tokens } from '@cosimosi/ui'

import { DeletionFlowSheet } from '../../../widgets/deletion-flow/index.ts'
import { DiaryReaderBlock } from '../../../widgets/diary-reader/index.ts'
// The diary-reader page ([D2]) lays out the archive block full-screen. Navigation and focus arrive
// as callback/data props from the app-layer route adapter, so this product page does not depend on
// React Navigation. The deletion flow consumes its shared target only while this page is active.
export function DiaryReaderPage({ active, onExit }: { active: boolean; onExit: () => void }) {
  return (
    <View style={styles.screen}>
      <DiaryReaderBlock onExit={onExit} />
      <DeletionFlowSheet active={active} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.bg,
    paddingHorizontal: tokens.spacing[4],
    paddingTop: tokens.spacing[8],
  },
})
