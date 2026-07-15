import { Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/recall-diary-stars ui ([D3]): the 이 일기로 태어난 별 보기 affordance — the ONLY paid
// action in the reader. It initiates the jump (the composing widget owns the quote → consent →
// recall sequencing) and disables itself when there is nothing to recall — no still-live star (a
// live memory is always priced above zero, so an empty membership is the only free/blocked case,
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
    <div className="flex justify-start">
      <Button color="primary" size="sm" onClick={onInitiate} disabled={liveCount === 0}>
        {m.diary_reader_recall_action()}
      </Button>
    </div>
  )
}
