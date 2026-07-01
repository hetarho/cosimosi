import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Fixed dev/preview port (strict = fail rather than fall back to another port).
  server: { port: 1214, strictPort: true },
  preview: { port: 1214, strictPort: true },
})
