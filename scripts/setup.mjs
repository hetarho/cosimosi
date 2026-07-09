// One-shot bootstrap for a fresh clone:  pnpm setup  →  pnpm dev
//
//   1. .env   (copy from .env.example if missing)
//   2. deps   (pnpm install — workspace)
//
// Local infra (Postgres), migrations, and codegen are not part of the platform
// foundation — they return with their own units (data-persistence, rpc-transport)
// and this bootstrap grows the corresponding steps back then.

import { copyFileSync, existsSync } from 'node:fs'
import { pnpm, repoRoot, section, ok, note, fail } from './lib.mjs'

async function main() {
  section('.env')
  if (existsSync(`${repoRoot}/.env`)) note('.env 이미 있음')
  else if (existsSync(`${repoRoot}/.env.example`)) {
    copyFileSync(`${repoRoot}/.env.example`, `${repoRoot}/.env`)
    ok('.env.example → .env 생성 (필요 시 키 채우기)')
  } else note('.env.example 없음 — 건너뜀')

  section('deps')
  pnpm(['install'])

  section('done')
  console.log(
    '  \x1b[32m✓\x1b[0m 준비 완료 — 웹 \x1b[1mpnpm dev:web\x1b[0m (:5173) · api \x1b[1mpnpm dev:api\x1b[0m (:8080) · 모바일 \x1b[1mpnpm dev:mobile\x1b[0m',
  )
}

main().catch((e) => fail(e.message))
