import { Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { SmoothScroll } from './SmoothScroll'
import { DevTools } from './DevTools'

/** 루트 레이아웃: 스무스 스크롤 + 라우트 출력 + 전역 토스트 + (dev) 데브툴. */
export function RootLayout() {
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
