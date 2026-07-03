import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The monorepo env lives at the repo root (shared with docker-compose and the api), so
  // read VITE_* from there instead of a per-app copy — one .env drives `pnpm dev`.
  envDir: fileURLToPath(new URL('../../', import.meta.url)),
  // Fixed dev/preview port (strict = fail rather than fall back to another port).
  server: { port: 1214, strictPort: true },
  preview: { port: 1214, strictPort: true },
})
