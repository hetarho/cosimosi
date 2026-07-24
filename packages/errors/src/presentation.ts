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
    error.reason === ERROR_REASONS.memoryInsufficientTwinkle
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
