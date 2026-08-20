import { Code } from '@connectrpc/connect'
import { m } from '@cosimosi/i18n'

import { ERROR_REASONS, toAppError, type AppError } from './core.ts'

export type ErrorSeverity = 'info' | 'warning' | 'danger'

export interface ErrorPresentation {
  severity: ErrorSeverity
  message: string
  showId: boolean
}

export function presentAppError(error: unknown): ErrorPresentation {
  const appError = toAppError(error)
  const showId = appError.reason === ERROR_REASONS.internal && appError.requestId.length > 0

  return {
    severity: severityFor(appError),
    message: showId
      ? m.error_internal({ requestId: appError.requestId })
      : (reasonMessage(appError.reason) ?? codeMessage(appError.connectCode)),
    showId,
  }
}

function severityFor(error: AppError): ErrorSeverity {
  if (error.connectCode === Code.Canceled) return 'info'
  if (
    error.retriable ||
    error.reason === ERROR_REASONS.twinkleInsufficient ||
    error.reason === ERROR_REASONS.memoryInsufficientTwinkle ||
    error.reason === ERROR_REASONS.storeInsufficientTwinkle
  ) {
    return 'warning'
  }
  return 'danger'
}

function reasonMessage(reason: string): string | undefined {
  switch (reason) {
    case ERROR_REASONS.twinkleInsufficient:
    case ERROR_REASONS.memoryInsufficientTwinkle:
      return m.error_twinkle_insufficient()
    // The generic resource-exhausted line would say nothing about the save, and the atomicity is the
    // honest thing to say. The item-specific line belongs to the panel, which has the metadata and a
    // row to point at.
    case ERROR_REASONS.storeInsufficientTwinkle:
      return m.error_store_insufficient()
    // The split not coming together is not an allowance being spent: the coarse resource-exhausted
    // line said "한도", which sent the writer looking for a limit that was never reached.
    case ERROR_REASONS.memoryEncodeRetryExhausted:
      return m.error_memory_encode_retry_exhausted()
    // The one refusal that IS an allowance. The window is UTC, so the copy promises no local time.
    case ERROR_REASONS.memoryAiCallCapReached:
      return m.error_memory_ai_call_cap_reached()
    case ERROR_REASONS.memorySyncConsentRequired:
      return m.error_memory_sync_consent_required()
    case ERROR_REASONS.memoryOperationConflict:
      return m.error_memory_operation_conflict()
    case ERROR_REASONS.memoryRecallMemoryNotFound:
    case ERROR_REASONS.memoryViewSemanticMemoryNotFound:
    case ERROR_REASONS.memoryReleaseMemoryNotFound:
      return m.error_memory_target_not_found()
    case ERROR_REASONS.memoryRecallMemoryUnavailable:
    case ERROR_REASONS.memoryReleaseMemoryUnavailable:
      return m.error_memory_target_unavailable()
    case ERROR_REASONS.memoryViewSemanticStageNotRisen:
      return m.error_memory_view_semantic_stage_not_risen()
    case ERROR_REASONS.memoryAlreadyReleased:
      return m.error_memory_already_released()
    case ERROR_REASONS.memoryRestoreWindowExpired:
      return m.error_memory_restore_window_expired()
    case ERROR_REASONS.adminForbidden:
      return m.error_admin_forbidden()
    case ERROR_REASONS.achievementScopeRequired:
      return m.error_achievement_scope_required()
    case ERROR_REASONS.achievementInputRequired:
      return m.error_achievement_input_required()
    // Both mean the list the user pressed from was stale, so the surface refetches AND says so —
    // silently refreshing under a press reads as the button having done nothing.
    case ERROR_REASONS.achievementNotFound:
      return m.error_achievement_not_found()
    case ERROR_REASONS.achievementNotAchieved:
      return m.error_achievement_not_achieved()
    // The claim WAS recorded and only the payout failed, so the copy says the reward is kept and to
    // try again. There is deliberately no ALREADY_CLAIMED reason to map: a repeat claim is a replay
    // that pays, and disabling the button on this one would strand the reward in the very window the
    // replay exists to heal.
    case ERROR_REASONS.achievementRewardUnavailable:
      return m.error_achievement_reward_unavailable()
    default:
      return undefined
  }
}

function codeMessage(code: Code): string {
  switch (code) {
    case Code.InvalidArgument:
    case Code.OutOfRange:
      return m.error_invalid_argument()
    case Code.Unauthenticated:
      return m.error_unauthenticated()
    case Code.PermissionDenied:
      return m.error_permission_denied()
    case Code.NotFound:
      return m.error_not_found()
    case Code.AlreadyExists:
    case Code.Aborted:
      return m.error_conflict()
    case Code.ResourceExhausted:
      return m.error_resource_exhausted()
    case Code.FailedPrecondition:
      return m.error_failed_precondition()
    case Code.DeadlineExceeded:
      return m.error_deadline_exceeded()
    case Code.Unavailable:
      return m.error_unavailable()
    case Code.Canceled:
      return m.error_canceled()
    case Code.Unimplemented:
      return m.error_unimplemented()
    case Code.DataLoss:
    case Code.Internal:
    case Code.Unknown:
      return m.error_unknown()
  }
}
