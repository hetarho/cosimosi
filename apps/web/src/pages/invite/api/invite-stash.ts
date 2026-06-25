// 초대 코드 보존(change 05) — Google OAuth는 풀페이지 라운드트립이라 `/`로 복귀하며 `?redirect`(코드 포함)를
// 잃는다(plan 01). 그래서 가입을 시작할 때 코드(+복귀 경로)를 sessionStorage에 stash해 두고, 인증 복귀 후
// `/invite`가 읽어 자동 redeem한다. sessionStorage = 탭 수명 한정·per-tab(공용 PC 영속 아님). 소비 즉시 비운다.
const KEY = 'cosimosi:invite'

export interface InviteStash {
  code: string
  /** 가입 전 원래 가려던 내부 경로(없으면 `/`). */
  redirect?: string
}

/** 가입 시작 시 코드+복귀 경로 저장(OAuth 라운드트립 대비). 비보안 컨텍스트/쿼터 실패는 무시(OTP는 URL로 보존). */
export function stashInvite(code: string, redirect?: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ code, redirect }))
  } catch {
    /* 무시 */
  }
}

/** 보존된 초대 stash 읽기(없거나 손상이면 null). */
export function readInviteStash(): InviteStash | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<InviteStash>
    if (typeof s.code !== 'string' || !s.code) return null
    return { code: s.code, redirect: typeof s.redirect === 'string' ? s.redirect : undefined }
  } catch {
    return null
  }
}

/** stash 비우기 — 소비(또는 실패)했으면 호출해 다음 진입에 다시 쓰이지 않게 한다. */
export function clearInviteStash(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* 무시 */
  }
}
