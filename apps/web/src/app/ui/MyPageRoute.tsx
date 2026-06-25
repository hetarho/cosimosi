import { MyPage } from '@/pages/my-page'
import { SessionContext, useAuthActions } from './session-context'

/**
 * 마이페이지 라우트 래퍼(change 09) — 앱 레이어가 현재 세션 이메일 + signOut을 resolve해 MyPage에
 * 내려준다. MyPage(pages)는 session-context를 직접 import하지 않는다(FSD). 로그아웃은 사이드바와
 * 같은 signOut 경로를 재사용한다.
 */
export function MyPageRoute() {
  const { signOut } = useAuthActions()
  const email = SessionContext.useSelector((s) => s.context.session?.user?.email ?? null)
  return <MyPage email={email} onSignOut={() => void signOut()} />
}
