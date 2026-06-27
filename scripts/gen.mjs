// Code generation: proto → Go·TS (buf) and SQL schema → Go (sqlc), all via Docker.
//
//   pnpm gen          both (whatever is configured)
//   pnpm gen:proto    buf only
//   pnpm gen:sql      sqlc only
//
// If a tool's config isn't present yet, the matching step skips with a note
// instead of failing.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { run, mount, hasBufConfig, hasSqlcInputs, section, ok, note, repoRoot } from './lib.mjs'

const target = process.argv[2] // undefined | 'proto' | 'sql'
const wantProto = !target || target === 'proto'
const wantSql = !target || target === 'sql'
const bufImage = 'bufbuild/buf:1.70.0'
const sqlcImage = 'sqlc/sqlc:1.31.1'

section('codegen')
let did = false

if (wantProto) {
  if (hasBufConfig()) {
    note('buf generate (proto → Go·TS)')
    // Template lives at proto/buf.gen.yaml, module input is proto/ — both must be
    // explicit (a bare `buf generate` at repo root has no buf.gen.yaml and fails).
    run('docker', [
      'run', '--rm',
      '-v', mount('', '/work'), '-w', '/work',
      bufImage,
      'generate', '--template', 'proto/buf.gen.yaml', 'proto',
    ])
    trimGeneratedTypeScript(join(repoRoot, 'packages/api-client/src/gen'))
    ok('buf 완료')
    did = true
  } else {
    note('buf 건너뜀 — proto/ 에 .proto 계약이 아직 없음 (전송 유닛에서 추가)')
  }
}

if (wantSql) {
  if (hasSqlcInputs()) {
    note('sqlc generate (apps/api/db schema+queries → Go)')
    run('docker', [
      'run', '--rm',
      '-v', mount('apps/api', '/app'), '-w', '/app',
      sqlcImage, 'generate',
    ])
    ok('sqlc 완료')
    did = true
  } else {
    note('sqlc 건너뜀 — apps/api/sqlc.yaml + db/migrations/*.sql + db/queries/*.sql 이 모두 필요함')
  }
}

if (!did) note('아직 생성할 대상 없음. 설정 추가 후 다시 실행하면 자동으로 켜져요.')

function trimGeneratedTypeScript(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      trimGeneratedTypeScript(path)
      continue
    }
    if (!path.endsWith('.ts')) continue
    const source = readFileSync(path, 'utf8')
    const trimmed = source.replace(/\n{2,}$/u, '\n')
    if (trimmed !== source) writeFileSync(path, trimmed)
  }
}
