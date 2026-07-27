import { StyleSheet, View } from 'react-native'

import { tokens } from '@cosimosi/ui'

import { TwinkleBalanceSummary } from './TwinkleBalanceSummary.tsx'
import { TwinkleLedgerList } from './TwinkleLedgerList.tsx'

// features/twinkle-ledger ui (RN fork, [G7][U9]): the /me stardust tab's whole content — the two kind
// balances above the chronological history of everything that came and went. Read-only: this slice
// issues no mutation and no memory.v1 call of any kind ([I2]).
export function TwinkleLedgerTab() {
  return (
    <View style={styles.tab}>
      <TwinkleBalanceSummary />
      <TwinkleLedgerList />
    </View>
  )
}

const styles = StyleSheet.create({
  tab: { gap: tokens.spacing[6] },
})
