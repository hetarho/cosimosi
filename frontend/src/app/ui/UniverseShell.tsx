import { HomePage } from '@/pages/home'
import { useAuthActions } from './session-context'

/**
 * 우주 셸 라우트 래퍼(change 09) — 앱 레이어가 session-context의 signOut을 resolve해 HomePage에
 * onSignOut으로 내려준다. HomePage(pages)는 session-context를 직접 import하지 않는다(FSD 단방향).
 * 우주 셸은 자체 사이드바에 로그아웃을 수렴하므로 SessionGate는 showChrome=false로 마운트된다.
 */
export function UniverseShell() {
  const { signOut } = useAuthActions()
  return <HomePage onSignOut={() => void signOut()} />
}
