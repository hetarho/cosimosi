import { useEarnRequestStore } from '@cosimosi/twinkle'
import { Button, Dialog } from '@cosimosi/ui'
import { useGistViewController } from '@cosimosi/universe/react/flows'
import { useInvalidateAchievements } from '@cosimosi/achievement/react'
import { useInvalidateTwinkleBalance } from '@cosimosi/twinkle/react'
import { useErrorToast } from '@cosimosi/errors/react'
import { SpendCostDisplay, gistViewSpend } from '../../../features/spend-cost-display/index.ts'
import { m } from '../../../shared/i18n/index.ts'

// widgets/star-detail ui: the 요지 보기 sheet. The paid read, its operation id, refusal routing and
// the busy/close rules are the package's gist-view controller; this file is the dialog markup.
export function GistViewSheet({
  episodicMemoryId,
  onClose,
}: {
  episodicMemoryId: string
  onClose: () => void
}) {
  const requestEarnGuide = useEarnRequestStore((state) => state.request)
  const { text, busy, failed, proceed, retry, close } = useGistViewController({
    episodicMemoryId,
    onClose,
    onError: useErrorToast(),
    invalidateBalance: useInvalidateTwinkleBalance(),
    invalidateAchievements: useInvalidateAchievements(),
    requestEarnGuide,
  })

  return (
    <Dialog open onClose={close} title={m.gist_view_title()} closeLabel={m.common_dismiss()}>
      <div className="flex flex-col gap-4">
        {text !== null ? (
          <>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-text">{text}</p>
            <div className="flex justify-end">
              <Button color="neutral" size="sm" onClick={close}>
                {m.common_dismiss()}
              </Button>
            </div>
          </>
        ) : busy ? (
          <p className="text-sm text-text-muted">{m.gist_view_loading()}</p>
        ) : failed ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">{m.gist_view_error()}</p>
            <div className="flex justify-end gap-2">
              <Button color="neutral" size="sm" onClick={close}>
                {m.twinkle_cost_cancel()}
              </Button>
              {/* Ambiguous failure → retry replays the same operation id directly (recovers a
                  committed-but-lost gist, no re-quote/second debit); a known refusal → re-show the
                  fresh cost gate so a real shortfall surfaces the charge path. */}
              <Button color="primary" size="sm" onClick={retry}>
                {m.common_retry()}
              </Button>
            </div>
          </div>
        ) : (
          <SpendCostDisplay
            pending={gistViewSpend(episodicMemoryId)}
            onProceed={proceed}
            onCancel={close}
            onEarn={requestEarnGuide}
          />
        )}
      </div>
    </Dialog>
  )
}
