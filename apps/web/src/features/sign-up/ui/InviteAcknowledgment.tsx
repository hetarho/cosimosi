import { pendingInvite } from '@cosimosi/auth'

import { m } from '../../../shared/i18n/index.ts'

export function InviteAcknowledgment() {
  if (!pendingInvite.peek()) return null
  return <p className="text-sm text-text-muted">{m.invite_acknowledgment()}</p>
}
