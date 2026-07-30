import { requestOnboardingReplay } from '@cosimosi/onboarding'
import { Button, Card } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/replay-onboarding ui ([O5]): the /me profile tab's last row.
//
// There is no teardown to do and nothing to reset — a replay is a `START` with a fresh run id, so the
// row places the request, hands control to the page's own exit callback, and the universe mount reads
// it. It is also the reason a skip needs no confirmation: a mis-skip costs one tap to undo, forever.
//
// A replay over a populated universe behaves identically. Steps 3–5 wait for a genuine second diary,
// which is a welcome act rather than a cost, and the skip is on screen for anyone who does not want to
// write one.
export function ReplayOnboarding({ onExit }: { onExit: () => void }) {
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-text-muted">{m.sequence_tour_replay_description()}</p>
      <div className="flex justify-end">
        <Button
          color="neutral"
          size="sm"
          onClick={() => {
            requestOnboardingReplay()
            onExit()
          }}
        >
          {m.sequence_tour_replay_action()}
        </Button>
      </div>
    </Card>
  )
}
