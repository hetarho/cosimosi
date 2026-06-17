#!/usr/bin/env node
// Scaffold the next sequential job (implementation doc) from a plan (new) or change (change).
// Usage: node new-job.mjs <plan|change> <NN> [--force]   (pnpm spec:job plan 15 ; pnpm spec:job change 03)
// Copies the source spec's 수용 기준 into the job's "인수 조건"; /implement-job fills the 구현 체크리스트.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const planDir = join(root, 'spec', 'plan')
const changesDir = join(root, 'spec', 'changes')
const jobsDir = join(root, 'spec', 'jobs')
const tpl = join(root, 'scripts', 'templates', 'job.md')

const args = process.argv.slice(2)
const force = args.includes('--force')
const pos = args.filter((a) => !a.startsWith('--'))
const kind = pos[0]
const nnArg = pos[1]
if (!['plan', 'change'].includes(kind) || !nnArg) {
  console.error('Usage: pnpm spec:job <plan|change> <NN> [--force]   (e.g. pnpm spec:job plan 15 ; pnpm spec:job change 03)')
  process.exit(1)
}
const nn = String(nnArg).replace(/[^0-9]/g, '').padStart(2, '0')
const srcDir = kind === 'plan' ? planDir : changesDir
const srcFile = readdirSync(srcDir).find((f) => f.startsWith(nn + '.') && f.endsWith('.md'))
if (!srcFile) { console.error(`No ${kind} at spec/${kind === 'plan' ? 'plan' : 'changes'}/${nn}.*.md`); process.exit(1) }
const srcText = readFileSync(join(srcDir, srcFile), 'utf8')
const sourceRef = `${kind === 'plan' ? 'plan' : 'changes'}/${srcFile.replace(/\.md$/, '')}`

const type = kind === 'plan' ? 'new' : 'change'
let planRef = sourceRef
let title = h1Title(srcText)
if (kind === 'change') {
  planRef = (srcText.match(/^plan:\s*(.+)$/m) || [])[1]?.trim() || 'plan/UNKNOWN'
  title = (srcText.match(/^title:\s*(.+)$/m) || [])[1]?.trim() || title
}

const jobnn = nextNum(jobsDir)
const out = join(jobsDir, `${jobnn}.${slugify(title)}.md`)
if (existsSync(out) && !force) { console.error(`${out} exists — --force to overwrite`); process.exit(1) }

let doc = fill(readFileSync(tpl, 'utf8'), { JOB: jobnn, TYPE: type, SOURCE: sourceRef, PLAN: planRef, TITLE: title })
const acc = extractAcceptance(srcText)
if (acc) doc = doc.replace('- [ ] A1 …', acc)
writeFileSync(out, doc, 'utf8')
console.log(`Created spec/jobs/${jobnn}.${slugify(title)}.md  (type=${type}, source=${sourceRef}, plan=${planRef})`)
console.log(`Next: /implement-job ${jobnn} — fill 구현 체크리스트, build, verify, reflect to SSOT.`)

function h1Title(t) {
  const m = t.match(/^#\s+(.+)$/m)
  if (!m) return 'untitled'
  return m[1].replace(/^\d+\.\s*/, '').replace(/^변경:\s*/, '').replace(/\s*[—-]\s*as-built.*$/i, '').replace(/\s*\(as-built\)\s*$/i, '').trim()
}
function extractAcceptance(t) {
  const sec = t.match(/##[^\n]*수용 기준[^\n]*\n([\s\S]*?)(?:\n##\s|\n---|$)/)
  if (!sec) return null
  const items = sec[1].split('\n').map((l) => l.replace(/^\s*(?:\d+\.|[-*])\s+/, '').trim()).filter((l) => l && !l.startsWith('<!--'))
  return items.length ? items.map((it, i) => `- [ ] A${i + 1} ${it}`).join('\n') : null
}
// Monotonic across live + archive/: done docs move to archive/ but their numbers must never be reused (job/change
// numbers are load-bearing refs). Scanning only the live dir would re-issue numbers after archiving.
function nextNum(dir) { const archive = join(dir, 'archive'); const files = existsSync(archive) ? [...readdirSync(dir), ...readdirSync(archive)] : readdirSync(dir); const m = files.map((f) => parseInt((f.match(/^(\d+)/) || [])[1], 10)).filter((n) => !isNaN(n)); return String((m.length ? Math.max(...m) : 0) + 1).padStart(2, '0') }
function slugify(s) { return s.toLowerCase().replace(/[\\/:*?"<>|.]+/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'untitled' }
function fill(t, m) { return Object.entries(m).reduce((a, [k, v]) => a.replaceAll(`{{${k}}}`, v), t) }
