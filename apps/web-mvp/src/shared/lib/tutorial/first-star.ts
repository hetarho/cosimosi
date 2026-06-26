// 실계정 첫 별 튜토리얼 완료 상태(change 34·job 50) — per-user localStorage 플래그. 서버/proto/DB는
// 건드리지 않는다(A19): account tutorial은 "이 브라우저에서 이 사용자가 첫 별 안내를 봤는가"만 기억하면
// 되고, 그건 클라 로컬 상태로 충분하다. user id로 네임스페이스해 한 기기를 여러 계정이 써도 섞이지 않는다.
//
// 순수 모듈(React/DOM/three 미의존, 헌법4) — 동기 게터로 노출해 HomePage가 진입 판정(starCount===0 &&
// !done)에 await 없이 쓴다. storage 접근 실패(private 모드 등)·user id 부재는 *자동 시작을 막는* 쪽으로
// 보수적으로 처리한다(false 단정이 아니라 "완료된 것으로 간주"해 강제 튜토리얼을 띄우지 않는다).

const KEY_PREFIX = 'cosimosi:first-star-tour:'

/** 이번 세션에서 storage가 막혔을 때의 fallback — 완료 표시를 메모리에만 들고 자동 재시작을 막는다. */
const sessionDone = new Set<string>()

function key(userId: string): string {
  return `${KEY_PREFIX}${userId}`
}

/** 이 사용자가 첫 별 튜토리얼을 이미 보았는가(완료/건너뛰기). user id가 없으면 자동 시작을 막기 위해
 *  true(=완료로 간주)를 돌려준다 — 익명/미해결 사용자에게 강제 튜토리얼을 띄우지 않는다. */
export function isFirstStarTourDone(userId: string | null | undefined): boolean {
  if (!userId) return true
  if (sessionDone.has(userId)) return true
  try {
    return localStorage.getItem(key(userId)) === '1'
  } catch {
    // storage 접근 불가 → 이번 세션 메모리 플래그만 신뢰. 아직 안 봤다면 한 번은 보여주되(false),
    // 완료 표시는 sessionDone로만 남아 같은 탭 안에서는 재시작을 막는다.
    return sessionDone.has(userId)
  }
}

/** 첫 별 튜토리얼 완료/건너뛰기 — 같은 브라우저/계정에서 자동 재시작하지 않게 표시한다(A17). */
export function completeFirstStarTour(userId: string | null | undefined): void {
  if (!userId) return
  sessionDone.add(userId)
  try {
    localStorage.setItem(key(userId), '1')
  } catch {
    /* storage 막힘 → sessionDone 메모리 플래그로 이번 세션은 동작 */
  }
}

/** 완료 상태를 지운다 — 사이드바 `다시 보기`가 실계정에서 비파괴 둘러보기를 다시 시작할 때 쓴다(A18). */
export function resetFirstStarTour(userId: string | null | undefined): void {
  if (!userId) return
  sessionDone.delete(userId)
  try {
    localStorage.removeItem(key(userId))
  } catch {
    /* noop */
  }
}
