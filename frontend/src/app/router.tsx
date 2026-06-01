import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { LandingPage } from '@/pages/landing'
import { RootLayout } from './RootLayout'

const rootRoute = createRootRoute({ component: RootLayout })

// 코드 기반 라우팅. 라우트는 app 레이어가 소유하고, 화면 UI는 pages 레이어에 위임한다(FSD).
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
})

const routeTree = rootRoute.addChildren([indexRoute])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
