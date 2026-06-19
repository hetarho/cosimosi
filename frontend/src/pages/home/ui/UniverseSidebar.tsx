// 우주 셸 햄버거 사이드바(change 09) — 우상단 햄버거가 여는 우측 드로어(shared/ui SideDrawer).
// 항목 순서(A2): 로그아웃 · 마이페이지 · 구분선 · 우주 공개 · 주고받은 별 · 구분선 · 일기.
// 데모 모드는 계정/소셜이 없으므로 로그아웃→`체험 종료`로 바뀌고 마이페이지·우주 공개·주고받은 별을
// 숨긴다(일기 탐색은 더미 데이터로 동작). 페이지(HomePage)가 핸들러를 내려 배선한다(FSD — feature/
// session-context 직접 import 없음). 작성 항목은 없다 — 새 별은 하단 floating 버튼(A17).
import { SideDrawer } from '@/shared/ui'

export interface UniverseSidebarProps {
  open: boolean
  onClose: () => void
  isDemo: boolean
  /** 실로그아웃(앱이 session-context.signOut을 내려준다). */
  onSignOut: () => void
  /** 체험 종료(데모) — 기존 동선 유지. */
  onLeaveDemo: () => void
  /** 둘러보기 다시 보기(데모) — 튜토리얼 투어를 처음부터(plan 48). */
  onReplayTour: () => void
  onMyPage: () => void
  onShare: () => void
  onGifts: () => void
  onDiary: () => void
}

const itemCls =
  'w-full rounded-lg px-3 py-2.5 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-white'

export function UniverseSidebar({
  open,
  onClose,
  isDemo,
  onSignOut,
  onLeaveDemo,
  onReplayTour,
  onMyPage,
  onShare,
  onGifts,
  onDiary,
}: UniverseSidebarProps) {
  return (
    <SideDrawer open={open} title="메뉴" onClose={onClose}>
      <nav className="flex flex-col gap-1">
        {isDemo ? (
          <button type="button" className={itemCls} onClick={onLeaveDemo}>
            체험 종료
          </button>
        ) : (
          <button type="button" className={itemCls} onClick={onSignOut}>
            로그아웃
          </button>
        )}
        {isDemo && (
          <button type="button" className={itemCls} onClick={onReplayTour}>
            둘러보기 다시 보기
          </button>
        )}
        {!isDemo && (
          <button type="button" className={itemCls} onClick={onMyPage}>
            마이페이지
          </button>
        )}

        {!isDemo && (
          <>
            <div className="my-1 h-px bg-white/10" />
            <button type="button" className={itemCls} onClick={onShare}>
              우주 공개
            </button>
            <button type="button" className={itemCls} onClick={onGifts}>
              주고받은 별
            </button>
          </>
        )}

        <div className="my-1 h-px bg-white/10" />
        <button type="button" className={itemCls} onClick={onDiary}>
          일기
        </button>
      </nav>
    </SideDrawer>
  )
}
