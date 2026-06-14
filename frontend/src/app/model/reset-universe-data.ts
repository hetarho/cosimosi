// 데이터 출처 경계 리셋(spec 16 리뷰 반영). GetUniverse·ListDormant·['record'] 쿼리 키는
// 사용자/모드를 포함하지 않고(단일 사용자 우주), 스토어 병합(merge)은 무삭제라 자체 치유가
// 없다 — 출처가 바뀌는 순간(로그아웃·계정 전환·체험 enter/exit) 캐시와 렌더 스토어를 통째로
// 비우는 것이 이전 출처의 별·일기 본문이 새 출처로 새지 않게 하는 유일한 경계다.
import { useMemoryStore, focusActor } from '@/entities/memory'
import { useSynapseStore } from '@/entities/synapse'
import { useAppearance } from '@/entities/appearance'
import { recallFlushActor } from '@/features/recall'
import { queryClient } from '../query-client'

export function resetUniverseData(): void {
  queryClient.clear()
  // 포커스(별 선택·일기 조망)도 출처를 넘기지 않는다 — 이전 출처의 선택/강조가 새 출처에 남지
  // 않게 한다(구 memory.select(null) + wayfinding.clear()의 단일 대체).
  focusActor.send({ type: 'DISMISS' })
  const memory = useMemoryStore.getState()
  memory.setStars([])
  memory.setLoadedEmpty(false) // 새 출처의 "빈 우주 확인"은 다음 GetUniverse가 다시 판정
  useSynapseStore.getState().setEdges([])
  // per-user 감정색 오버라이드(spec 30)도 출처를 넘기지 않는다 — 다음 사용자가 GetSettings로
  // 다시 시드한다(테마·오브제는 기기 선호라 유지). 미인증 전환이면 기본 팔레트로 복귀.
  useAppearance.getState().resetServerSettings()
  // 이전 출처의 미flush 공동회상 페어·lastViewedId도 경계를 넘지 않는다(세션 교체 — flushing 중이면
  // RESET이 invoke를 취소해 그 배치가 새 세션에 적용되지 않는다).
  recallFlushActor.send({ type: 'RESET' })
}
