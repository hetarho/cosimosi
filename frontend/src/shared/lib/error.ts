/** unknown 에러 → 사용자 표시용 메시지 문자열(쿼리 에러 카드 공용). */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
