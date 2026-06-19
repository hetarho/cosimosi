// shared/api Public API — 명시 export만 (배럴 `export *` 금지, FSD 공개 API 규칙).
export { supabase, getAccessToken } from './supabase'
export { memoryClient, transport, giftTransport } from './transport'
// proto 계약 타입/값 — gen/은 슬라이스 내부이므로 소비처는 이 공개 API로만 가져온다(FSD §2.5).
export {
  Mood,
  MemoryService,
  SettingsService,
  RecordSchema,
  StarSchema,
  SynapseSchema,
  GetUniverseResponseSchema,
  ListDormantResponseSchema,
  ListRecordsResponseSchema,
  RecordSummarySchema,
  GetSettingsResponseSchema,
  GetInventoryResponseSchema,
} from './gen/cosimosi/v1/memory_pb'
export type {
  Star,
  Record,
  Synapse,
  GetUniverseResponse,
  ListDormantResponse,
  RecordSummary,
  ListRecordsResponse,
  EvolutionSnapshot,
  GetEvolutionHistoryResponse,
  Settings,
  GetSettingsResponse,
  GetInventoryResponse,
  PurchaseItemResponse,
} from './gen/cosimosi/v1/memory_pb'
// 우주 공개 계약(spec 35) — ShareService(인증, 소유자 설정) + VisitService(무인증 공개 방문).
export { VisitService, ShareService, GetShareSettingsResponseSchema } from './gen/cosimosi/v1/share_pb'
export type {
  SharedStar,
  SharedSynapse,
  GetSharedUniverseResponse,
  GetShareSettingsResponse,
  UpdateShareSettingsResponse,
  RotateShareSlugResponse,
  // 겹쳐보기(spec 37) — 공명 다리(인증 ShareService).
  ResonanceBridge,
  GetResonanceBridgesResponse,
} from './gen/cosimosi/v1/share_pb'
// 함께한 기억 — 공명 계약(spec 36) — GiftService(전부 인증): 별 보내기·열기·수락·거절·취소·목록·공명정보.
export { GiftService, GiftStatus } from './gen/cosimosi/v1/gift_pb'
export type {
  SendStarGiftResponse,
  GetStarGiftResponse,
  AcceptStarGiftResponse,
  ListStarGiftsResponse,
  GiftSummary,
  GetResonanceInfoResponse,
} from './gen/cosimosi/v1/gift_pb'
// 관리자 콘솔 계약(spec 34) — AdminService는 서버 allowlist 게이트 뒤에 있다.
export { AdminService } from './gen/cosimosi/v1/admin_pb'
export type {
  ProviderConfig,
  GetLLMConfigResponse,
  GetAdminOverviewResponse,
  TestProviderKeyResponse,
  UsageRow,
  DayCount,
  AdminUser,
} from './gen/cosimosi/v1/admin_pb'
// 초대 멤버십 게이트 계약(spec 41) — InviteService(인증, 멤버십 불필요: validate·redeem·멤버십 상태) +
// InviteAdminService(인증 + admin allowlist: 발행·목록·취소). 제거 가능한 베타 게이트 묶음.
export { InviteService, InviteAdminService, InviteReason, InviteCodeStatus } from './gen/cosimosi/v1/invite_pb'
export type {
  InviteCode,
  GetMembershipStatusResponse,
  ValidateInviteCodeResponse,
  RedeemInviteCodeResponse,
  ListInviteCodesResponse,
  IssueInviteCodeResponse,
  RevokeInviteCodeResponse,
} from './gen/cosimosi/v1/invite_pb'
