import { useState } from 'react'

import { Alert, Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

export interface LaunchButtonProps {
  /** True when the diary date is before the universe's present ([T1][I10]). */
  readonly pastDated: boolean
  readonly busy?: boolean
  /** Perform the launch; the widget runs LaunchStars + the optimistic insert. */
  readonly onLaunch: () => void
}

// features/launch-stars ui: 별 띄우기 ([W3]). For a past-dated diary it surfaces the one-time
// confirmation notice before launch — the diary is saved without lighting a star ([W5][T1][I10]) —
// so the outcome is never a silent surprise; a same-date launch confirms directly.
//
// Visual language: the notice is the design system's inline alert in its warning role, `live=status`
// because the consequence is being offered rather than reported (§9). It takes the full row
// (`w-full` in the widget's wrapping action group) so the sentence is never squeezed beside a
// button, and the confirming action stays last on the right (§4).
export function LaunchButton({ pastDated, busy, onLaunch }: LaunchButtonProps) {
  const [confirming, setConfirming] = useState(false)

  if (pastDated && confirming) {
    return (
      <div className="flex w-full flex-col gap-3">
        <Alert variant="warning" live="status">
          {m.writing_flow_past_date_notice()}
        </Alert>
        <Button color="primary" className="self-end" disabled={busy} onClick={onLaunch}>
          {m.writing_flow_past_date_confirm()}
        </Button>
      </div>
    )
  }

  return (
    <Button
      color="primary"
      disabled={busy}
      onClick={() => (pastDated ? setConfirming(true) : onLaunch())}
    >
      {m.writing_flow_launch_action()}
    </Button>
  )
}
