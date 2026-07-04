#!/usr/bin/env node
// Generate the mobile dev sign-in bypass user id from the root .env, so web, api, and mobile
// share ONE COSIMOSI_DEV_USER_ID with no hand-sync (code-review 03 / R003). Runs on mobile dev
// start (the mobile package's start/ios/android scripts). Intentionally NOT part of `pnpm gen` /
// check-generated.mjs — its source is the local, gitignored .env, so a per-developer override
// must not fail the generated-freshness gate. The committed default is 'dev-user' (matches
// scripts/seed-dev-universe.sql), so CI typecheck/build has a value without any .env present.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_DEV_USER_ID = 'dev-user'
const SAFE_ID = /^[A-Za-z0-9_-]+$/

function readEnvValue(file, key) {
  if (!existsSync(file)) return undefined
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1 || trimmed.slice(0, eq).trim() !== key) continue
    return trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
  }
  return undefined
}

const raw = readEnvValue(join(root, '.env'), 'COSIMOSI_DEV_USER_ID')
// Fall back to the default for an unset, empty, or unsafe id (a value with quotes/newlines would
// break the emitted literal — dev user ids are the seed slug or a random hex id, both safe).
const devUserId = raw && SAFE_ID.test(raw) ? raw : DEFAULT_DEV_USER_ID

const out = join(root, 'apps/mobile/src/shared/config/dev-user.gen.ts')
const content = `// GENERATED from the root .env COSIMOSI_DEV_USER_ID - DO NOT EDIT.
// Run \`node scripts/gen-mobile-env.mjs\` (auto-runs on mobile dev start). Single-sources the dev
// sign-in bypass id across web, api, and mobile; defaults to '${DEFAULT_DEV_USER_ID}' when unset.
export const MOBILE_DEV_USER_ID = '${devUserId}';
`
writeFileSync(out, content, 'utf8')
console.log(`Generated ${out} (MOBILE_DEV_USER_ID='${devUserId}')`)
