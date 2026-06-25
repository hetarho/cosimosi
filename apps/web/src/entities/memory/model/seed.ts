// Deterministic per-star seed derived from the memory id. Single source: the star
// mapper and the optimistic-record flow both import THIS helper so the same id always
// yields the same seed → the same star shape (reproducibility). Server `visual_spec`
// is currently unused. Pure: no three/React/DOM.

/** seedFromId(id) → a stable value in [0, 1) (FNV-1a 32-bit, normalized). */
export function seedFromId(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) / 4294967296
}

// 별 형태(geometry) 고유성을 주는 3축 시드(spec 53). 단일 seed는 회전/무늬만 흔들어 같은 form이면
// 실루엣이 거의 같았다 — 정점 변위·비대칭을 별마다 다르게 굴리려면 서로 독립적인 축이 셋 필요하다.
// 축 0은 seedFromId(id)와 정확히 동일하게 두어 기존 wobble·fibonacci 배치·surface 무늬가 안 바뀐다
// (회귀 경계 A5). 축 1·2는 id에 다른 접미사를 덧대 재해시 — 결정론적이고 축끼리 상관 없다(Math.random 비사용, A3).
export function seedComponents(id: string): readonly [number, number, number] {
  return [seedFromId(id), seedFromId(id + ':1'), seedFromId(id + ':2')]
}
