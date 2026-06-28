// Code generation: inlang message sources → typed Paraglide message functions.
//
//   pnpm gen:messages   compile packages/i18n/messages/*.json → packages/i18n/src/gen
//
// Part of `pnpm gen`; the output is committed and checked by `pnpm check:gen`
// (packages/**/gen/**). The locale strategy is `globalVariable` so the generated
// runtime references no DOM/native globals — both apps drive the active locale
// through the @cosimosi/i18n facade (overwriteGetLocale/overwriteSetLocale), which
// keeps the package importable from web, React Native, and Node tests alike.

import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { compile } from '@inlang/paraglide-js'
import { ok, note, repoRoot, section } from './lib.mjs'

const outdir = join(repoRoot, 'packages/i18n/src/gen')

section('codegen — messages')
note('paraglide compile (packages/i18n/messages/*.json → src/gen)')

await compile({
  project: join(repoRoot, 'packages/i18n/project.inlang'),
  outdir,
  strategy: ['globalVariable', 'baseLocale'],
})

// The compiler always drops a `.gitignore` (`*`) that would untrack its own
// output, plus a README stamped with the absolute project path. This repo commits
// generated code and checks its freshness (check:gen), so untrack-and-stamp both
// fight that: remove them to keep the output tracked and byte-identical across
// machines. The message logic in runtime.js/messages.js is path-free.
for (const noise of ['.gitignore', '.prettierignore', 'README.md']) {
  rmSync(join(outdir, noise), { force: true })
}

ok('paraglide 완료')
