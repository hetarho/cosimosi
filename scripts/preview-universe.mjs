import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const directory = path.join(root, '.git/universe-review')
if (!existsSync(path.join(directory, 'as-is/index.html'))) {
  execFileSync('node', ['scripts/capture-universe-baseline.mjs', '--restore'], {
    cwd: root,
    stdio: 'inherit',
  })
}
execFileSync(
  'pnpm',
  [
    '--filter',
    '@cosimosi/web',
    'exec',
    'vite',
    'build',
    '--base',
    '/__review/to-be/',
    '--outDir',
    path.join(directory, 'to-be'),
    '--emptyOutDir',
  ],
  {
    cwd: root,
    env: { ...process.env, ...loadEnv('production', root, 'VITE_'), VITE_DEV_USER_ID: '' },
    stdio: 'inherit',
  },
)
const url = 'http://localhost:1214/review'
try {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Preview unavailable')
  console.log(`Review ready: ${url}`)
} catch {
  console.log(`Starting local preview: ${url}`)
  const server = spawn('pnpm', ['dev:web'], { cwd: root, stdio: 'inherit' })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal))
  server.on('exit', (code) => process.exit(code ?? 0))
}
