import { fileURLToPath } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // The monorepo env lives at the repo root (shared with docker-compose and the api), so
  // read VITE_* from there instead of a per-app copy — one .env drives `pnpm dev`.
  const envDir = fileURLToPath(new URL('../../', import.meta.url))

  // The dev sign-in bypass must never be baked into a SHIPPED build artifact. Fail a CI build (not
  // just the runtime provider) when VITE_DEV_USER_ID is present, so a misconfigured CI/deploy is
  // blocked at build time rather than crashing later in the browser. Scoped to `command === 'build'`
  // (never a dev server) AND `process.env.CI` — locally a developer legitimately keeps the value in
  // `.env` for `pnpm dev`, and the pre-commit hook builds with that `.env` loaded, so an
  // unconditional throw would block every local commit; CI is where the deploy artifact is built and
  // where the value must be absent. The runtime assert in src/app/providers/auth-provider.tsx stays
  // as universal defense in depth. loadEnv reads the root .env files; process.env also catches a
  // value passed straight on the build command line.
  const env = loadEnv(mode, envDir, 'VITE_')
  if ((env.VITE_DEV_USER_ID || process.env.VITE_DEV_USER_ID) && command === 'build' && process.env.CI) {
    throw new Error(
      'VITE_DEV_USER_ID must not be set in a CI/production build (dev sign-in bypass) — unset it before building.',
    )
  }

  return {
    plugins: [react(), tailwindcss()],
    envDir,
    // Internal workspace packages export source directly (no build step) and are symlinked into
    // node_modules. Vite pre-bundles node_modules deps by default and then serves the cached bundle,
    // so edits to packages/*/src would NOT hot-reload until a dev-server restart. Excluding them from
    // pre-bundling makes Vite serve + watch their source directly, so design-system edits (packages/ui)
    // HMR live. Add any new @cosimosi/* workspace package here.
    optimizeDeps: {
      exclude: [
        '@cosimosi/3d-renderer',
        '@cosimosi/api-client',
        '@cosimosi/auth',
        '@cosimosi/client-cache',
        '@cosimosi/config',
        '@cosimosi/emotion',
        '@cosimosi/force-sim',
        '@cosimosi/i18n',
        '@cosimosi/memory',
        '@cosimosi/memory-logic',
        '@cosimosi/observability',
        '@cosimosi/state-machine',
        '@cosimosi/ui',
        '@cosimosi/universe',
        '@cosimosi/universe-render',
      ],
    },
    // Fixed dev/preview port (strict = fail rather than fall back to another port).
    server: { port: 1214, strictPort: true },
    preview: { port: 1214, strictPort: true },
  }
})
