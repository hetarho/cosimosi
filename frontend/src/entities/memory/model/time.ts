// proto ISO 타임스탬프 파싱의 단일 출처. 폴백 정책(파싱 불가 → fallback, 보통 now =
// "방금" = 최대 밝기·잠듦 아님)은 별/시냅스/잠든 별 목록이 같은 값으로 읽어야 한다 —
// 흩어진 복사본이 페이지마다 다른 밝기를 만들지 않게 여기서만 정의한다.
/** ISO 문자열 → epoch ms; 파싱 불가하면 fallback. */
export function parseEpochMs(iso: string, fallback: number): number {
  const parsed = Date.parse(iso)
  return Number.isFinite(parsed) ? parsed : fallback
}
