import { Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { DevTools } from './devtools'

/** 루트 레이아웃: 라우트 출력 + 전역 토스트 + (dev) 데브툴. */
export function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster position="bottom-right" theme="dark" richColors />
      <DevTools />
    </>
  )
}
