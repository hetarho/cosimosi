import { StyleSheet, View } from 'react-native'

import { useIsFocused } from '@react-navigation/native'

import { tokens } from '@cosimosi/ui'

import { DeletionFlowSheet } from '../../../widgets/deletion-flow/index.ts'
import { DiaryReaderBlock } from '../../../widgets/diary-reader/index.ts'
import { ROUTES, type RootStackScreenProps } from '../routes.ts'

// The diary-reader screen ([D2]): mobile screens are the pages layer (no pages/ dir on native).
// It lays out the archive block full-screen and supplies the navigation seam back to the
// universe — the widget never reaches react-navigation itself (that stays in this app layer). The
// deletion flow is mounted here too so a per-entry full-delete opens over the reader; it consumes
// the shared target only while this screen is focused (the universe screen stays mounted beneath).
export function DiaryReaderScreen({ navigation }: RootStackScreenProps<'DiaryReader'>) {
  const isFocused = useIsFocused()
  return (
    <View style={styles.screen}>
      <DiaryReaderBlock onExit={() => navigation.navigate(ROUTES.universe)} />
      <DeletionFlowSheet active={isFocused} />
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
