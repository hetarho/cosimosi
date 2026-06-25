import { create } from 'zustand'

/**
 * 무대(stage) 상태 — change 31 인터랙션 모델. 랜딩은 더 이상 카드마다 자족 인터랙션을 품지 않는다.
 * 콘텐츠 영역의 트리거(버튼/일기 UI)가 이 한 곳의 상태를 갱신하고, 그 결과가 화면 상단 고정 무대
 * (StageLayer)에서 펼쳐진다. 좌표·치수는 무대 로컬 정규화 단위(아래) — StageLayer가 SVG로 사상한다.
 *
 * 좌표계: x,y ∈ [0,100] 무대 정규화(좌상=0,0). size ∈ [0,1](StageLayer가 SVG 반경으로 사상).
 * brightness ∈ [0,1] — 별·시냅스는 어두워질 뿐 사라지지 않는다(헌법 §2). 색은 mood hex 그대로 운반(헌법 의미색 보존).
 */

/** 무대를 구동하는 콘텐츠 장(章). 스크롤 순서 = 전체 뇌과학 아크. */
export type ActId =
  | 'hero'
  | 'concept'
  | 'diary'
  | 'hebbian'
  | 'reconsolidation'
  | 'forgetting'
  | 'present'
  | 'nightly'
  | 'resonance'

export interface StageStar {
  id: string
  /** 무대 정규화 좌표 [0,100]. */
  x: number
  y: number
  /** 코어 크기 [0,1] — StageLayer가 SVG 반경으로 사상. */
  size: number
  /** 의미 색(mood hex) — 룩·형태가 바뀌어도 보존. */
  color: string
  /** 유효 밝기 [0,1]. 바닥은 A_MIN(망각 무대) — 0이 되어 사라지지 않는다. */
  brightness: number
  /** 형태 시드(결정론) — 같은 별은 같은 모양. 재공고화에서 미세 jitter. */
  seed?: number
  /** true면 클릭으로 재점화(망각 무대). 무대가 그 앵커 위에 투명 버튼을 깐다. */
  clickable?: boolean
}

export interface StageSynapse {
  id: string
  /** 양 끝 별 id. */
  a: string
  b: string
  /** 연결 색(보통 한쪽 별 mood). */
  color: string
  /** 0~1 강도 → 굵기·밝기. */
  strength: number
  /** 곡률(직선 금지 — 항상 곡선). */
  arc?: number
  active?: boolean
}

export interface StageScene {
  stars: StageStar[]
  synapses: StageSynapse[]
}

const EMPTY: StageScene = { stars: [], synapses: [] }

interface StageState {
  /** 현재 활성 장 — 스크롤이 콘텐츠 장에 들어오면 그 장이 set. */
  activeAct: ActId
  /** 무대 장면(활성 장이 구동). */
  scene: StageScene
  /** 랜딩 전역 배경 물듦 색(요즘의 나 장) — null이면 테마 기본. */
  bgMood: string | null
  /** 클릭 가능한 별의 핸들러(활성 장이 등록 — 망각 무대 재점화). */
  onStarClick: ((id: string) => void) | null

  setActiveAct: (id: ActId) => void
  /** 활성 장이 자기 장면을 무대에 투영(replace). */
  setScene: (scene: StageScene) => void
  setBgMood: (mood: string | null) => void
  setStarClick: (handler: ((id: string) => void) | null) => void
}

export const useStage = create<StageState>((set) => ({
  activeAct: 'hero',
  scene: EMPTY,
  bgMood: null,
  onStarClick: null,
  // 활성 장 전환 = 무대의 단일 출처 교체. 직전 장의 장면·물듦·클릭 핸들러를 비우고(이전 장 잔상 방지),
  // 새 장이 자기 효과로 다시 채운다(히어로는 비운 채 둬 엠블럼만 보인다). 같은 id면 무변(no-op).
  setActiveAct: (id) =>
    set((s) => (s.activeAct === id ? s : { activeAct: id, scene: EMPTY, bgMood: null, onStarClick: null })),
  setScene: (scene) => set({ scene }),
  setBgMood: (bgMood) => set({ bgMood }),
  setStarClick: (onStarClick) => set({ onStarClick }),
}))
