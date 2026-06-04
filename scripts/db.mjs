// Migrations via goose, run as a one-shot Docker container on the compose network.
//
//   pnpm db:migrate   goose up      (apply all)
//   pnpm db:status    goose status
//   pnpm db:down      goose down    (roll back one)
//   pnpm db:reset     goose reset + up  (wipe to clean schema, re-apply)
//
// Requires postgres to be running (`pnpm infra:up` / `pnpm setup`). The schema
// itself lands in spec 03; until then there's nothing to migrate, so we skip.

import { run, mount, hasDbSchema, COMPOSE_NETWORK, section, ok, note, fail } from './lib.mjs'

const DBSTRING = 'postgres://cosimosi:cosimosi@postgres:5432/cosimosi?sslmode=disable'

// goose has no official Docker image (pressly publishes binaries only), so we use the
// maintained kukymbr/goose-docker wrapper: it mounts /migrations, reads GOOSE_DRIVER /
// GOOSE_DBSTRING, and takes the command via GOOSE_COMMAND (defaults to up).
const goose = (command) =>
  run('docker', [
    'run', '--rm', '--network', COMPOSE_NETWORK,
    '-v', mount('backend/internal/db/migrations', '/migrations'),
    '-e', 'GOOSE_DRIVER=postgres',
    '-e', `GOOSE_DBSTRING=${DBSTRING}`,
    '-e', `GOOSE_COMMAND=${command}`,
    'ghcr.io/kukymbr/goose-docker:3.27.1',
  ])

const action = process.argv[2] ?? 'up'
section(`db ${action}`)

if (!hasDbSchema()) {
  note('마이그레이션이 아직 없음 — DB 스키마는 spec 03에서 추가됨. 건너뜀.')
  process.exit(0)
}

switch (action) {
  case 'up':
    goose('up')
    ok('마이그레이션 적용 완료')
    break
  case 'status':
    goose('status')
    break
  case 'down':
    goose('down')
    ok('한 단계 롤백 완료')
    break
  case 'reset':
    goose('reset') // down to zero
    goose('up') // re-apply clean
    ok('스키마 리셋 완료')
    break
  default:
    fail(`알 수 없는 db 액션: '${action}' (up | status | down | reset)`)
}
