import { Badge, Button } from '@cosimosi/ui'

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
    // [D11] makes the free/paid line visible, not merely true: this is the one control on the page
    // that spends, and it says so beside itself. Still no amount — the quote belongs to the modal.
    <div className="flex flex-col items-start gap-1">
      <span className="inline-flex items-center gap-1.5">
        <Button color="primary" size="sm" onClick={onInitiate} disabled={liveCount === 0}>
          {m.diary_reader_recall_action()}
        </Button>
        {/* The marker rides beside the control, not inside its label, so the copy stays one sentence
            in both locales and the badge is what carries "this one costs". */}
        <Badge variant="neutral">{m.twinkle_balance_general_label()}</Badge>
      </span>
      <p className="text-xs text-text-subtle">{m.diary_reader_paid_hint()}</p>
    </div>
  )
}
