import { StyleSheet, View } from 'react-native'

import { tokens } from '@cosimosi/ui'

import { DiaryReaderBlock } from '../../../widgets/diary-reader/index.ts'
import { ROUTES, type RootStackScreenProps } from '../routes.ts'

// The diary-reader screen ([D2]): mobile screens are the pages layer (no pages/ dir on native).
// It lays out the archive block full-screen and supplies the navigation seam back to the
// universe — the widget never reaches react-navigation itself (that stays in this app layer).
export function DiaryReaderScreen({ navigation }: RootStackScreenProps<'DiaryReader'>) {
  return (
    <View style={styles.screen}>
      <DiaryReaderBlock onExit={() => navigation.navigate(ROUTES.universe)} />
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
