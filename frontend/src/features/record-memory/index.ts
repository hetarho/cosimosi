// Public API for the record-memory feature (named exports — no wildcard).
export { MemoryForm } from './ui/MemoryForm'
// 작성 머신(spec 39 P3) — 구 draft-store + use-record-memory 대체. 페이지가 compose 'submitted'에서
// scheduleSynapseSync로 시냅스 지연 refetch를 건다(queryClient는 페이지 몫).
export {
  composeActor,
  selectPhase,
} from './model/compose.machine'
export { scheduleSynapseSync } from './api/record-memory'
