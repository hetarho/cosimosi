import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  // 단일 루트 .env 를 FE·BE가 공유한다(README의 `cp .env.example .env`). Vite 기본 envDir은
  // 프로젝트 루트(=apps/web/)라, 명시적으로 리포 루트로 올린다 — 안 그러면 VITE_* 가 안 읽힌다.
  const envDir = path.resolve(__dirname, '../..')
  const env = loadEnv(mode, envDir, '')
  const apiUrl = env.VITE_API_URL ?? 'http://localhost:8080'
  // Sentry release 태깅(spec 18, 3.4): 명시한 VITE_APP_VERSION이 없으면 CF Workers
  // 빌드가 제공하는 커밋 SHA를 쓴다. 로컬 빌드는 빈 문자열 → release 태깅 생략.
  const appVersion = env.VITE_APP_VERSION ?? process.env.WORKERS_CI_COMMIT_SHA ?? ''

  return {
    envDir,
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 1214,
      strictPort: true,
      proxy: {
        // Connect transport uses baseUrl '/api' (shared/api/transport.ts); strip the
        // prefix so '/api/cosimosi.v1.MemoryService/…' reaches the backend at root '/'.
        '/api': { target: apiUrl, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
        '/health': { target: apiUrl, changeOrigin: true },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
    },
  }
})
