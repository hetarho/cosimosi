import { defineConfig } from 'vitest/config'

// Primitive tests render the DOM (*.tsx) variants, so they need a browser-like
// environment. The *.native.tsx siblings import react-native and are covered by
// the package typecheck + the mobile app, never loaded here.
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
