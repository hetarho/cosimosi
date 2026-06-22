// 라이브 셰이더 튜너(dev 전용) — 별/나 셰이더의 "매직넘버"들을 TSL uniform 노드로 노출해, DebugTuner 패널의
// 슬라이더가 `.value`만 갱신하면 rebuild·하드새로고침 없이 즉시 화면에 반영된다(셰이더는 HMR이 안 먹으므로
// 매번 재빌드+새로고침하던 루프를 없앤다). 각 uniform 기본값 = 현재 하드코딩 상수라, 패널을 안 건드리거나
// 프로덕션(패널 미마운트)에선 동작이 완전히 동일하다. 좋은 값을 찾으면 그 수치를 셰이더에 다시 굽고 이 모듈을
// 지우면 된다(스캐폴딩). 값은 localStorage에 저장돼 새로고침해도 유지된다(지오메트리 변경 등으로 새로고침이
// 필요할 때 튜닝값을 잃지 않게).
import { uniform } from 'three/tsl'

export interface TuneKnob {
  key: string
  label: string
  group: string
  min: number
  max: number
  step: number
  default: number
}

// 노출 노브 — 기본값은 셰이더의 현재 상수와 일치(별 facet/빛, 나 표면 밝기).
export const TUNE_KNOBS: readonly TuneKnob[] = [
  // 별 — facet 표면(면 입체감)
  { key: 'starFacetFloor', label: 'facet 바닥 (실루엣 면 어둡기)', group: '별 · facet', min: 0, max: 1, step: 0.01, default: 0.15 },
  { key: 'starFacetGain', label: 'facet 게인 (면대면 대비)', group: '별 · facet', min: 0, max: 1, step: 0.01, default: 0.85 },
  { key: 'starFacetEdgeGain', label: 'facet 엣지 스파클', group: '별 · facet', min: 0, max: 2, step: 0.01, default: 0.45 },
  { key: 'starFacetEdgePow', label: 'facet 엣지 날카로움', group: '별 · facet', min: 1, max: 10, step: 0.1, default: 4.0 },
  // 씬 — 별 albedo를 비추는 유일한 빛(평면 채움). 낮추면 facet 헤드램프 모델링이 살고, 높이면 평평해진다.
  { key: 'ambientFill', label: 'ambient 채움광 (평면 바닥)', group: '씬', min: 0, max: 1.5, step: 0.01, default: 0.4 },
  // 별 — 빛(전역 트림 × surface별 STAR_SURFACE_MIX 비중). 기본 1 = surface 비중 그대로.
  { key: 'starSelfMul', label: '자가발광 전역트림 (×)', group: '별 · 빛', min: 0, max: 3, step: 0.01, default: 1.0 },
  { key: 'starReflectMul', label: '반사 전역트림 (×)', group: '별 · 빛', min: 0, max: 4, step: 0.01, default: 1.0 },
  { key: 'reflectRecencyFloor', label: '반사 recency 바닥 (0=옛별 검정)', group: '별 · 빛', min: 0, max: 1, step: 0.01, default: 0 },
  // 나(self) — 표면별 밝기
  { key: 'selfMirror', label: '미러 밝기', group: '나 · 표면', min: 0, max: 2, step: 0.01, default: 0.35 },
  { key: 'selfPrism', label: '프리즘 밝기', group: '나 · 표면', min: 0, max: 2, step: 0.01, default: 0.7 },
  { key: 'selfNeuron', label: '뉴런 밝기', group: '나 · 표면', min: 0, max: 2, step: 0.01, default: 0.85 },
]

const LS_KEY = 'cosimosi:tune'

function loadOverrides(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {}
  } catch {
    return {}
  }
}

const overrides = loadOverrides()
const values: Record<string, number> = {}

/** key → TSL uniform 노드. 셰이더가 상수 대신 이 노드를 읽는다(모든 소비처가 같은 노드 인스턴스를 공유). */
export const TUNE: Record<string, ReturnType<typeof uniform>> = {}

for (const k of TUNE_KNOBS) {
  const v = Object.hasOwn(overrides, k.key) ? overrides[k.key] : k.default
  values[k.key] = v
  TUNE[k.key] = uniform(v)
}

export function getTune(key: string): number {
  return values[key] ?? 0
}

export function setTune(key: string, value: number): void {
  values[key] = value
  const u = TUNE[key]
  if (u) u.value = value
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(values))
    } catch {
      /* 저장 실패는 무시(튜닝은 계속 동작) */
    }
  }
}

export function resetTune(): void {
  for (const k of TUNE_KNOBS) setTune(k.key, k.default)
}

/** 현재 값 스냅샷(패널 "값 복사"용). */
export function tuneSnapshot(): Record<string, number> {
  return { ...values }
}
