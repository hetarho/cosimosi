// ListDormant query identity remains here because recall invalidates the dormant cache after
// a star wakes. The retired dedicated dormant view used to own the fetch/select layer.
import { createConnectQueryKey } from '@connectrpc/connect-query'
import { MemoryService } from '@/shared/api'

/** ListDormant 부분 키(transport·input 생략 → 모든 변형 매치) — invalidate 전용(1.6:
 *  회상된 별은 잠에서 깸 → 다음 잠든 별 오버레이 진입 시 목록에서 제외). */
export function dormantInvalidateKey() {
  return createConnectQueryKey({ schema: MemoryService.method.listDormant, cardinality: 'finite' })
}
