// Migrations via goose, run as a one-shot Docker container on the compose network.
//
//   pnpm db:migrate   goose up      (apply all)
//   pnpm db:status    goose status
//   pnpm db:down      goose down    (roll back one)
//   pnpm db:reset     goose reset + up  (wipe to clean schema, re-apply)
//
// The script starts the local postgres service when migrations exist. Before the
// first migration is authored, there's nothing to apply, so we skip cleanly.

import { run, mount, hasDbMigrations, COMPOSE_NETWORK, section, ok, note, fail } from './lib.mjs'

const DBSTRING =
  process.env.COSIMOSI_MIGRATION_DATABASE_URL ??
  'postgres://cosimosi:cosimosi@postgres:5432/cosimosi?sslmode=disable'
const GOOSE_IMAGE = 'ghcr.io/kukymbr/goose-docker:3.27.1'
const MIGRATIONS = 'apps/api/db/migrations'

// goose has no official Docker image (pressly publishes binaries only), so we use the
// maintained kukymbr/goose-docker wrapper: it mounts /migrations, reads GOOSE_DRIVER /
// GOOSE_DBSTRING, and takes the command via GOOSE_COMMAND (defaults to up).
const goose = (command) =>
  run('docker', [
    'run', '--rm', '--network', COMPOSE_NETWORK,
    '-v', mount(MIGRATIONS, '/migrations'),
    '-e', 'GOOSE_DRIVER=postgres',
    '-e', `GOOSE_DBSTRING=${DBSTRING}`,
    '-e', `GOOSE_COMMAND=${command}`,
    GOOSE_IMAGE,
  ])

const action = process.argv[2] ?? 'up'
section(`db ${action}`)

if (!['up', 'status', 'down', 'reset'].includes(action)) {
  fail(`알 수 없는 db 액션: '${action}' (up | status | down | reset)`)
}

if (!hasDbMigrations()) {
  note('마이그레이션이 아직 없음 — DB 스키마가 추가되면 적용됨. 건너뜀.')
  process.exit(0)
}

if (action !== 'status') {
  run('docker', ['compose', 'up', '-d', '--wait', 'postgres'])
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
}
