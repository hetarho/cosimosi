import { Code, ConnectError } from '@connectrpc/connect'
import { ErrorInfoSchema } from '@cosimosi/api-client'

export const ERROR_REASONS = {
  internal: 'INTERNAL',
  unknown: 'UNKNOWN',
  platformUnauthenticated: 'PLATFORM_UNAUTHENTICATED',
  platformAuthVerifierUnavailable: 'PLATFORM_AUTH_VERIFIER_UNAVAILABLE',
  accountUnknownPalette: 'ACCOUNT_UNKNOWN_PALETTE',
  accountScopeRequired: 'ACCOUNT_SCOPE_REQUIRED',
  adminForbidden: 'ADMIN_FORBIDDEN',
  adminSeedAdminUndemotable: 'ADMIN_SEED_ADMIN_UNDEMOTABLE',
  adminUserIdRequired: 'ADMIN_USER_ID_REQUIRED',
  adminGrantAmountRange: 'ADMIN_GRANT_AMOUNT_RANGE',
  adminGrantIdRequired: 'ADMIN_GRANT_ID_REQUIRED',
  adminUnknownCapability: 'ADMIN_UNKNOWN_CAPABILITY',
  adminProviderRequired: 'ADMIN_PROVIDER_REQUIRED',
  adminProviderKeyRequired: 'ADMIN_PROVIDER_KEY_REQUIRED',
  adminUnknownProvider: 'ADMIN_UNKNOWN_PROVIDER',
  adminProviderCapabilityMismatch: 'ADMIN_PROVIDER_CAPABILITY_MISMATCH',
  adminProviderNotImplemented: 'ADMIN_PROVIDER_NOT_IMPLEMENTED',
  adminProviderKeyMissing: 'ADMIN_PROVIDER_KEY_MISSING',
  adminSecretboxDisabled: 'ADMIN_SECRETBOX_DISABLED',
  memoryDiaryDateInvalid: 'MEMORY_DIARY_DATE_INVALID',
  memoryEncodeInputRequired: 'MEMORY_ENCODE_INPUT_REQUIRED',
  memoryLaunchInvalidMemories: 'MEMORY_LAUNCH_INVALID_MEMORIES',
  memoryRecallInputRequired: 'MEMORY_RECALL_INPUT_REQUIRED',
  memoryViewSemanticInputRequired: 'MEMORY_VIEW_SEMANTIC_INPUT_REQUIRED',
  memoryProvenanceInputRequired: 'MEMORY_PROVENANCE_INPUT_REQUIRED',
  memoryExportFormatRequired: 'MEMORY_EXPORT_FORMAT_REQUIRED',
  memoryDiaryPageTokenInvalid: 'MEMORY_DIARY_PAGE_TOKEN_INVALID',
  memoryReleaseInputRequired: 'MEMORY_RELEASE_INPUT_REQUIRED',
  memoryLetGoInvalidApproved: 'MEMORY_LET_GO_INVALID_APPROVED',
  memoryOperationIdRequired: 'MEMORY_OPERATION_ID_REQUIRED',
  memoryOperationConflict: 'MEMORY_OPERATION_CONFLICT',
  memoryRecallMemoryNotFound: 'MEMORY_RECALL_MEMORY_NOT_FOUND',
  memoryRecallNoLiveMemories: 'MEMORY_RECALL_NO_LIVE_MEMORIES',
  memoryViewSemanticMemoryNotFound: 'MEMORY_VIEW_SEMANTIC_MEMORY_NOT_FOUND',
  memoryProvenanceMemoryNotFound: 'MEMORY_PROVENANCE_MEMORY_NOT_FOUND',
  memoryReleaseMemoryNotFound: 'MEMORY_RELEASE_MEMORY_NOT_FOUND',
  memoryReleaseNoLiveMemories: 'MEMORY_RELEASE_NO_LIVE_MEMORIES',
  memoryRestoreNotReleased: 'MEMORY_RESTORE_NOT_RELEASED',
  memoryRecallMemoryUnavailable: 'MEMORY_RECALL_MEMORY_UNAVAILABLE',
  memoryViewSemanticStageNotRisen: 'MEMORY_VIEW_SEMANTIC_STAGE_NOT_RISEN',
  memoryReleaseMemoryUnavailable: 'MEMORY_RELEASE_MEMORY_UNAVAILABLE',
  memoryAlreadyReleased: 'MEMORY_ALREADY_RELEASED',
  memoryRestoreWindowExpired: 'MEMORY_RESTORE_WINDOW_EXPIRED',
  memorySyncConsentRequired: 'MEMORY_SYNC_CONSENT_REQUIRED',
  memoryInsufficientTwinkle: 'MEMORY_INSUFFICIENT_TWINKLE',
  memoryEncodeRetryExhausted: 'MEMORY_ENCODE_RETRY_EXHAUSTED',
  memoryScopeRequired: 'MEMORY_SCOPE_REQUIRED',
  twinkleInviteInputRequired: 'TWINKLE_INVITE_INPUT_REQUIRED',
  twinkleChargeInputRequired: 'TWINKLE_CHARGE_INPUT_REQUIRED',
  twinkleQuoteInputRequired: 'TWINKLE_QUOTE_INPUT_REQUIRED',
  twinkleQuoteTargetNotFound: 'TWINKLE_QUOTE_TARGET_NOT_FOUND',
  twinkleInsufficient: 'TWINKLE_INSUFFICIENT',
  twinklePaymentVerificationUnavailable: 'TWINKLE_PAYMENT_VERIFICATION_UNAVAILABLE',
  twinkleInviteResolutionUnavailable: 'TWINKLE_INVITE_RESOLUTION_UNAVAILABLE',
  twinklePaymentBeneficiaryMismatch: 'TWINKLE_PAYMENT_BENEFICIARY_MISMATCH',
  twinkleInviteBeneficiaryMismatch: 'TWINKLE_INVITE_BENEFICIARY_MISMATCH',
  twinkleInviteNotEligible: 'TWINKLE_INVITE_NOT_ELIGIBLE',
  twinkleInviteGrantConflict: 'TWINKLE_INVITE_GRANT_CONFLICT',
  twinklePaymentNotVerified: 'TWINKLE_PAYMENT_NOT_VERIFIED',
  twinkleQuoteTargetUnavailable: 'TWINKLE_QUOTE_TARGET_UNAVAILABLE',
  twinkleScopeRequired: 'TWINKLE_SCOPE_REQUIRED',
} as const

export type ErrorReason = (typeof ERROR_REASONS)[keyof typeof ERROR_REASONS]

export interface AppError {
  connectCode: Code
  reason: string
  domain: string
  requestId: string
  metadata: Readonly<Record<string, string>>
  debugDetail: string
  retriable: boolean
}

export type ErrorRecovery = 'sync-consent' | 'charge' | 'none'

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  if (!(error instanceof ConnectError)) {
    return {
      connectCode: Code.Unknown,
      reason: ERROR_REASONS.unknown,
      domain: '',
      requestId: '',
      metadata: {},
      debugDetail: '',
      retriable: isRetriableCode(Code.Unknown),
    }
  }

  const detail = error.findDetails(ErrorInfoSchema)[0]
  const fallback = fallbackReason(error.code)
  return {
    connectCode: error.code,
    reason: detail?.reason || fallback.reason,
    domain: detail?.domain || fallback.domain,
    requestId: detail?.requestId ?? '',
    metadata: { ...(detail?.metadata ?? {}) },
    debugDetail: detail?.debugDetail ?? '',
    retriable: isRetriableCode(error.code),
  }
}

export function isReason(error: unknown, reason: ErrorReason): boolean {
  return toAppError(error).reason === reason
}

export function classifyErrorRecovery(error: unknown, syncConsentGiven = false): ErrorRecovery {
  if (!syncConsentGiven && isReason(error, ERROR_REASONS.memorySyncConsentRequired)) {
    return 'sync-consent'
  }
  if (
    isReason(error, ERROR_REASONS.memoryInsufficientTwinkle) ||
    isReason(error, ERROR_REASONS.twinkleInsufficient)
  ) {
    return 'charge'
  }
  return 'none'
}

export function isRetriableCode(code: Code): boolean {
  switch (code) {
    case Code.Unknown:
    case Code.DeadlineExceeded:
    case Code.ResourceExhausted:
    case Code.Aborted:
    case Code.Internal:
    case Code.Unavailable:
      return true
    case Code.Canceled:
    case Code.InvalidArgument:
    case Code.NotFound:
    case Code.AlreadyExists:
    case Code.PermissionDenied:
    case Code.FailedPrecondition:
    case Code.OutOfRange:
    case Code.Unimplemented:
    case Code.DataLoss:
    case Code.Unauthenticated:
      return false
  }
}

function isAppError(value: unknown): value is AppError {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<AppError>
  return (
    typeof candidate.connectCode === 'number' &&
    typeof candidate.reason === 'string' &&
    typeof candidate.domain === 'string' &&
    typeof candidate.requestId === 'string' &&
    typeof candidate.metadata === 'object' &&
    candidate.metadata !== null &&
    typeof candidate.debugDetail === 'string' &&
    typeof candidate.retriable === 'boolean'
  )
}

function fallbackReason(code: Code): { reason: string; domain: string } {
  if (code === Code.Internal) {
    return { reason: ERROR_REASONS.internal, domain: 'platform' }
  }
  if (code === Code.Unknown) {
    return { reason: ERROR_REASONS.unknown, domain: 'platform' }
  }
  return {
    reason: `PLATFORM_${codeName(code)}`,
    domain: 'platform',
  }
}

function codeName(code: Code): string {
  switch (code) {
    case Code.Canceled:
      return 'CANCELED'
    case Code.Unknown:
      return 'UNKNOWN'
    case Code.InvalidArgument:
      return 'INVALID_ARGUMENT'
    case Code.DeadlineExceeded:
      return 'DEADLINE_EXCEEDED'
    case Code.NotFound:
      return 'NOT_FOUND'
    case Code.AlreadyExists:
      return 'ALREADY_EXISTS'
    case Code.PermissionDenied:
      return 'PERMISSION_DENIED'
    case Code.ResourceExhausted:
      return 'RESOURCE_EXHAUSTED'
    case Code.FailedPrecondition:
      return 'FAILED_PRECONDITION'
    case Code.Aborted:
      return 'ABORTED'
    case Code.OutOfRange:
      return 'OUT_OF_RANGE'
    case Code.Unimplemented:
      return 'UNIMPLEMENTED'
    case Code.Internal:
      return 'INTERNAL'
    case Code.Unavailable:
      return 'UNAVAILABLE'
    case Code.DataLoss:
      return 'DATA_LOSS'
    case Code.Unauthenticated:
      return 'UNAUTHENTICATED'
  }
}
