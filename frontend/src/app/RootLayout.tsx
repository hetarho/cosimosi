import { useEffect } from 'react'
import { Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { useAppearance } from '@/entities/appearance'
import { SmoothScroll } from './SmoothScroll'
import { DevTools } from './DevTools'

/** 루트 레이아웃: 스무스 스크롤 + 라우트 출력 + 전역 토스트 + (dev) 데브툴. */
export function RootLayout() {
  // 코스모스 색 테마를 <html>(=color.css :root, --p-neutral-* 사다리 선언처)에 앱 전역으로 박는다.
  // 커스텀 속성 var()는 선언된 요소에서 치환되므로, 축(--theme-bg-hue/chroma) override와 neutral
  // 선언이 같은 요소(html)에 있어야 배경·표면이 테마색으로 함께 전환된다. 랜딩·우주 모두 이를 따른다.
  const theme = useAppearance((s) => s.theme)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <>
      <SmoothScroll>
        <Outlet />
      </SmoothScroll>
      <Toaster position="bottom-right" theme="dark" richColors />
      <DevTools />
    </>
  )
}
