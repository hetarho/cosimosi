import { StyleSheet, View } from 'react-native'

import { useTwinkleBalanceQuery } from '@cosimosi/twinkle/react'
import { tokens } from '@cosimosi/ui'

import { TwinkleBalance } from '../../../entities/twinkle/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { TwinkleLedgerList } from './TwinkleLedgerList.tsx'

// features/twinkle-ledger ui (RN fork, [G7][U9]): the /me stardust tab's whole content — the two kind
// balances above the chronological history of everything that came and went. Read-only: this slice
// issues no mutation and no memory.v1 call of any kind ([I2]).
export function TwinkleLedgerTab() {
  // The tab is its own reader — mounted without the overlay, nothing else would fetch the balance.
  useTwinkleBalanceQuery()
  return (
    <View style={styles.tab}>
      <View accessibilityLabel={m.twinkle_balance_title()}>
        <TwinkleBalance form="list" />
      </View>
      <TwinkleLedgerList />
    </View>
  )
}

const styles = StyleSheet.create({
  tab: { gap: tokens.spacing[6] },
})
