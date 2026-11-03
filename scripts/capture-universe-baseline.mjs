import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  existsSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  symlinkSync,
} from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loadEnv } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const directory = path.join(root, '.git/universe-review')
const metadata = path.join(directory, 'baseline.json')
const retained = path.join(root, 'scripts/universe-review/baseline.json')
const restore = process.argv.includes('--restore')
if (existsSync(metadata) && !restore)
  throw new Error('A baseline is already preserved. Use --restore to rebuild that same commit.')
const commit = existsSync(metadata)
  ? JSON.parse(readFileSync(metadata, 'utf8')).commit
  : existsSync(retained)
    ? JSON.parse(readFileSync(retained, 'utf8')).commit
    : execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const source = path.join(directory, 'source')
mkdirSync(source, { recursive: true })
const archive = execFileSync('git', ['archive', commit], {
  cwd: root,
  maxBuffer: 100 * 1024 * 1024,
})
execFileSync('tar', ['-x', '-C', source], { input: archive })
const modules = path.join(source, 'node_modules')
mkdirSync(modules, { recursive: true })
for (const entry of readdirSync(path.join(root, 'node_modules'))) {
  if (entry === '@cosimosi') continue
  const target = path.join(modules, entry)
  if (!existsSync(target)) symlinkSync(path.join(root, 'node_modules', entry), target)
}
const workspaceModules = path.join(modules, '@cosimosi')
mkdirSync(workspaceModules, { recursive: true })
for (const entry of readdirSync(path.join(source, 'packages'))) {
  const manifestPath = path.join(source, 'packages', entry, 'package.json')
  if (!existsSync(manifestPath)) continue
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const target = path.join(workspaceModules, manifest.name.split('/')[1])
  if (!existsSync(target)) symlinkSync(path.dirname(manifestPath), target)
}
// Only the public Vite configuration is used; local authentication bypasses cannot enter a build.
const env = { ...process.env, ...loadEnv('production', root, 'VITE_'), VITE_DEV_USER_ID: '' }
execFileSync(
  'pnpm',
  [
    'exec',
    'vite',
    'build',
    '--base',
    '/__review/as-is/',
    '--outDir',
    path.join(directory, 'as-is'),
    '--emptyOutDir',
  ],
  {
    cwd: path.join(source, 'apps/web'),
    env,
    stdio: 'inherit',
  },
)
writeFileSync(
  metadata,
  JSON.stringify({ commit, capturedAt: new Date().toISOString() }, null, 2) + '\n',
)
console.log(`Preserved ${commit}. Start pnpm dev:web and open /review.`)
