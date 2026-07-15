import { StyleSheet, View } from 'react-native'

import { Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/recall-diary-stars ui (RN fork, [D3]): the 이 일기로 태어난 별 보기 affordance — the
// ONLY paid action in the reader. It initiates the jump (the composing widget owns the quote →
// consent → recall sequencing) and disables itself when there is nothing to recall — no still-live
// star (a live memory is always priced above zero, so an empty membership is the only blocked case,
// [D3][G4]). It performs no spend and reads no price of its own (CC3): the server quote is fetched
// once, in the jump modal, not per list row.
export function RecallDiaryStarsAction({
  liveCount,
  onInitiate,
}: {
  liveCount: number
  onInitiate: () => void
}) {
  return (
    <View style={styles.action}>
      <Button color="primary" size="sm" onPress={onInitiate} disabled={liveCount === 0}>
        {m.diary_reader_recall_action()}
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  action: { alignItems: 'flex-start' },
})
