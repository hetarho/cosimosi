import { defineConfig } from 'vitest/config'

// Primitive tests render the DOM (*.tsx) variants, so they need a browser-like environment. The
// native-fork contract tests mock the small RN host surface they exercise, then import the
// *.native.tsx siblings directly in this same runner.
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
