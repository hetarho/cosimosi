import { TwinkleBalanceSummary } from './TwinkleBalanceSummary.tsx'
import { TwinkleLedgerList } from './TwinkleLedgerList.tsx'

// features/twinkle-ledger ui ([G7][U9]): the /me stardust tab's whole content — the two kind balances
// above the chronological history of everything that came and went. Read-only: this slice issues no
// mutation and no memory.v1 call of any kind ([I2]).
export function TwinkleLedgerTab() {
  return (
    <div className="flex flex-col gap-6">
      <TwinkleBalanceSummary />
      <TwinkleLedgerList />
    </div>
  )
}
