// One-shot bootstrap for a fresh clone:  pnpm setup  →  pnpm dev
//
//   1. .env            (copy from .env.example if missing)
//   2. deps            (pnpm install — workspace)
//   3. postgres        (docker compose up -d postgres, wait for healthy)
//   4. migrations      (goose up — skips until spec 03 lands)
//   5. codegen         (buf + sqlc — skip whichever isn't configured yet)
//
// Idempotent: safe to re-run after pulling contract/schema changes. The inner
// dev loop (`pnpm dev`) intentionally does NOT re-run this — run setup (or the
// individual `pnpm gen` / `pnpm db:migrate`) only when proto/schema changes.

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { run, pnpm, repoRoot, section, ok, note, fail } from './lib.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitHealthy(container, timeoutSec) {
  note(`${container} health 대기...`)
  for (let i = 0; i < timeoutSec; i++) {
    const r = spawnSync('docker', ['inspect', '--format', '{{.State.Health.Status}}', container], {
      encoding: 'utf8',
    })
    if ((r.stdout || '').trim() === 'healthy') return ok('postgres healthy')
    await sleep(1000)
  }
  fail(`${container} 가 ${timeoutSec}s 안에 healthy 상태가 되지 못했어요. 'docker compose logs postgres' 확인.`)
}

async function main() {
  section('.env')
  if (existsSync(`${repoRoot}/.env`)) note('.env 이미 있음')
  else {
    copyFileSync(`${repoRoot}/.env.example`, `${repoRoot}/.env`)
    ok('.env.example → .env 생성 (필요 시 키 채우기)')
  }

  section('deps')
  pnpm(['install'])

  section('infra (postgres)')
  run('docker', ['compose', 'up', '-d', 'postgres'])
  await waitHealthy('cosimosi-postgres', 60)

  run('node', ['scripts/db.mjs', 'up'])
  run('node', ['scripts/gen.mjs'])

  section('done')
  console.log('  \x1b[32m✓\x1b[0m 준비 완료 — 이제  \x1b[1mpnpm dev\x1b[0m  로 프론트(:1214)+백엔드(:8080) 기동')
}

main().catch((e) => fail(e.message))
