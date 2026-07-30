#!/usr/bin/env node
// Stages the built blog into the app's asset directory, so one Worker serves both from one origin.
//
// The ORDER is the whole reason this is a script and not a `cp` in a package.json chain. Vite empties
// `outDir` when it builds, so a copy staged before the web build is silently deleted and the deploy goes
// out with `/blog/**` missing — a production 404 that nothing in the build output complains about. Hence
// the two assertions below: this refuses to run before the web build, and refuses to succeed if the staged
// tree does not actually contain a page and its assets afterwards. The ordering bug becomes a build error.
//
//   node scripts/stage-blog.mjs

import { cpSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { fail, ok, repoRoot, section } from './lib.mjs'

const blogDist = join(repoRoot, 'apps/blog/dist')
const webDist = join(repoRoot, 'apps/web/dist')
const staged = join(webDist, 'blog')

section('stage blog into the web assets')

if (!existsSync(blogDist)) {
  fail('apps/blog/dist is missing — run `pnpm build:blog` first')
}

// The one that catches the ordering mistake: if the web build has not run yet, staging now would be
// erased by it.
if (!existsSync(webDist)) {
  fail(
    'apps/web/dist is missing — build the web app BEFORE staging, or Vite will empty the directory and delete the staged blog',
  )
}

rmSync(staged, { recursive: true, force: true })
cpSync(blogDist, staged, { recursive: true })

// Astro emits the blog under its own `base`, so the built tree already contains a `blog/` directory. Copy
// it flat if so, rather than nesting `blog/blog/`.
const nested = join(staged, 'blog')
if (existsSync(nested)) {
  const lifted = join(webDist, '.blog-lift')
  rmSync(lifted, { recursive: true, force: true })
  cpSync(nested, lifted, { recursive: true })
  rmSync(staged, { recursive: true, force: true })
  cpSync(lifted, staged, { recursive: true })
  rmSync(lifted, { recursive: true, force: true })
}

for (const required of ['index.html', '_astro']) {
  if (!existsSync(join(staged, required))) {
    fail(
      `apps/web/dist/blog/${required} is missing after staging — the blog build output is not what this script expects`,
    )
  }
}

ok('apps/web/dist/blog contains index.html and _astro')
