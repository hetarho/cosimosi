// Shared helpers for the DX bootstrap scripts.
//
// Why Node (not a Makefile/bash script): the toolchain (buf/sqlc/goose) runs in
// Docker because Windows Application Control blocks unsigned .exe in the user dir
// (see README). These wrappers invoke Docker identically from PowerShell, bash, or
// CI — no per-shell quoting. The scripts light up when a tool's config is
// present and skip cleanly otherwise.

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Repo root, derived from this file's location (works regardless of cwd).
export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// docker -v wants forward slashes even on Windows (C:/Users/...:/work).
const posix = (p) => p.replace(/\\/g, '/')

/** Build a `docker -v` mount string. hostRel is relative to repo root ('' = root). */
export const mount = (hostRel, container) =>
  `${posix(hostRel ? `${repoRoot}/${hostRel}` : repoRoot)}:${container}`

/** Run a command, inheriting stdio, rooted at the repo. Returns exit code. */
export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: repoRoot, shell: false, ...opts })
  if (r.error) {
    if (r.error.code === 'ENOENT') fail(`'${cmd}' 를 찾을 수 없어요. 설치/PATH를 확인하세요.`)
    throw r.error
  }
  if (r.status) fail(`'${cmd} ${args.join(' ')}' 가 코드 ${r.status} 로 실패했어요.`)
  return r.status ?? 0
}

// pnpm is a .cmd shim on Windows → libuv can't exec it directly; go via cmd /c
// (no shell:true, so no arg-escaping deprecation and no injection surface).
export const pnpm = (args) =>
  process.platform === 'win32' ? run('cmd', ['/c', 'pnpm', ...args]) : run('pnpm', args)

// Compose project is `name: cosimosi` → default network is stable.
export const COMPOSE_NETWORK = 'cosimosi_default'

// --- sentinels: a step runs only once its tool's config is present ---
export const hasBufConfig = () => existsSync(`${repoRoot}/proto/buf.gen.yaml`)
export const hasDbSchema = () => existsSync(`${repoRoot}/apps/api/internal/db/schema.sql`)

// --- console output ---
export const section = (t) => console.log(`\n\x1b[36m▶ ${t}\x1b[0m`)
export const note = (t) => console.log(`  \x1b[2m·\x1b[0m ${t}`)
export const ok = (t) => console.log(`  \x1b[32m✓\x1b[0m ${t}`)
export function fail(msg) {
  console.error(`\n\x1b[31m✗ ${msg}\x1b[0m`)
  process.exit(1)
}
