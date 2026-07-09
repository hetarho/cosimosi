#!/usr/bin/env node
// Spec & workflow hygiene — two gaps that let stale/inconsistent workflow docs teach future agents the wrong thing
// (code-review 03, R003 + R004). Neither is covered by any existing gate.
//
//   A (R003)  Workflow-skill links resolve. Every SKILL.md under .claude/skills + .codex/skills must not link to a
//             file that doesn't exist — the exact bug where /create-plan pointed at a non-existent plan/21 & plan/30
//             (and at the wrong depth). Anchor fragments and {{placeholders}} are skipped; only the file part of a
//             relative link is checked. (Scaffold templates are excluded: their links are relative to the scaffold
//             *destination* — spec/jobs, spec/plan, … — not to scripts/templates/, so they can't be resolved in place.)
//   B (R004)  Job status ↔ location consistency. A `status: done` job must live under spec/jobs/archive/ (never left
//             in spec/jobs/, the "done but unarchived" bug from job 17); a `status: todo|doing` job must NOT be in
//             archive/. This keeps the jobs board trustworthy for the workflow that carries architecture into code.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { repoRoot, section, ok, note, fail } from './lib.mjs'

const problems = []

section('Spec & workflow hygiene — doc links (R003) + job status/location (R004)')

// ---- A) workflow-skill links resolve ----
const SKILL_ROOTS = ['.claude/skills', '.codex/skills']
const skillFiles = (absDir) => {
  const out = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name === 'SKILL.md') out.push(p) // the workflow instruction docs (not vendored READMEs)
    }
  }
  if (existsSync(absDir)) walk(absDir)
  return out
}
const LINK = /\]\(([^)]+)\)/g
let checkedLinks = 0
for (const root of SKILL_ROOTS) {
  for (const file of skillFiles(join(repoRoot, root))) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(LINK)) {
      let target = m[1].trim()
      if (!target || target.includes('{{')) continue // template placeholder
      if (/^(https?:|mailto:|#)/.test(target)) continue // external / pure anchor
      target = target.split('#')[0] // drop anchor fragment
      if (!target) continue
      checkedLinks++
      const resolved = resolve(dirname(file), target)
      if (!existsSync(resolved)) {
        problems.push(
          `${file.replace(repoRoot + '/', '')} → broken link \`${m[1]}\` (resolves to a path that doesn't exist).`,
        )
      }
    }
  }
}
note(`checked ${checkedLinks} relative links across ${SKILL_ROOTS.join(', ')} (SKILL.md only)`)

// ---- B) job status ↔ location ----
const readStatus = (file) => {
  const m = readFileSync(file, 'utf8').match(/^status:\s*([A-Za-z]+)/m)
  return m ? m[1].toLowerCase() : null
}
const jobsDir = join(repoRoot, 'spec/jobs')
if (existsSync(jobsDir)) {
  for (const e of readdirSync(jobsDir, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue // skip the archive/ dir
    const status = readStatus(join(jobsDir, e.name))
    if (status === 'done') {
      problems.push(
        `spec/jobs/${e.name} is \`status: done\` but still in spec/jobs/ — move it to spec/jobs/archive/ (a done job must be archived).`,
      )
    }
  }
  const archiveDir = join(jobsDir, 'archive')
  if (existsSync(archiveDir)) {
    for (const e of readdirSync(archiveDir, { withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith('.md')) continue
      const status = readStatus(join(archiveDir, e.name))
      if (status === 'todo' || status === 'doing') {
        problems.push(
          `spec/jobs/archive/${e.name} is \`status: ${status}\` but archived — unfinished jobs belong in spec/jobs/, not archive/.`,
        )
      }
    }
  }
}

if (problems.length) {
  for (const p of problems) console.error(`  \x1b[31m✗\x1b[0m ${p}`)
  fail(
    `${problems.length} spec-hygiene issue(s). See code-review 03 (R003 doc links · R004 job status/location).`,
  )
}
ok('workflow-doc links resolve; job status matches location')
