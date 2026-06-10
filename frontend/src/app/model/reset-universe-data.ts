// 데이터 출처 경계 리셋(spec 16 리뷰 반영). GetUniverse·ListDormant·['record'] 쿼리 키는
// 사용자/모드를 포함하지 않고(단일 사용자 우주), 스토어 병합(merge)은 무삭제라 자체 치유가
// 없다 — 출처가 바뀌는 순간(로그아웃·계정 전환·체험 enter/exit) 캐시와 렌더 스토어를 통째로
// 비우는 것이 이전 출처의 별·일기 본문이 새 출처로 새지 않게 하는 유일한 경계다.
import { useMemoryStore } from '@/entities/memory'
import { useSynapseStore } from '@/entities/synapse'
import { useRecallStore } from '@/features/recall'
import { queryClient } from '../query-client'

export function resetUniverseData(): void {
  queryClient.clear()
  const memory = useMemoryStore.getState()
  memory.select(null)
  memory.setStars([])
  useSynapseStore.getState().setEdges([])
  // 이전 출처의 미flush 공동회상 페어·lastViewedId도 경계를 넘지 않는다(세션 교체).
  useRecallStore.getState().reset()
}
