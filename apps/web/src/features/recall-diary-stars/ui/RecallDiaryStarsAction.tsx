import { Button } from '@cosimosi/ui'
import { m } from '../../../shared/i18n/index.ts'

export function RecallDiaryStarsAction({
  liveCount,
  onInitiate,
}: {
  liveCount: number
  onInitiate: () => void
}) {
  return (
    <div>
      <Button color="primary" size="sm" onClick={onInitiate} disabled={liveCount === 0}>
        {m.diary_reader_recall_action()}
      </Button>
    </div>
  )
}
