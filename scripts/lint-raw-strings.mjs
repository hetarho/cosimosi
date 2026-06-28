#!/usr/bin/env node
// Raw user-facing string lint (plan/08 A6): user-facing copy in UI components must
// go through message functions (`m.*`), not raw literals, so localization stays the
// default path. It parses each .tsx/.jsx with the TypeScript AST and flags two
// things only:
//   1. JSX text nodes that contain letters  (<h1>hello</h1>);
//   2. string literals on user-facing JSX attributes (title/placeholder/alt/label/
//      aria-*/accessibility*).
// Everything else is intentionally out of scope, which is how the documented non-UI
// cases stay quiet: developer logs, thrown Error messages, route ids, className/id/
// testID and other structural attributes, `{m.x()}` expressions, domain names in
// model/proto/SQL — none are JSX user-facing literals. Tests, generated code, and
// stories are skipped by path; a line carrying `i18n-ignore` opts that node out.
//
//   node scripts/lint-raw-strings.mjs            scan the real UI tree
//   node scripts/lint-raw-strings.mjs --probe    self-test the catch + ignore rules

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'
import ts from 'typescript'
import { fail, ok, repoRoot, section } from './lib.mjs'

const probe = process.argv.includes('--probe')

const roots = ['apps/web/src', 'apps/mobile/src', 'packages/ui/src']
const scanExtensions = new Set(['.tsx', '.jsx'])
const ignoredSegments = new Set(['node_modules', 'dist', 'build', 'coverage', 'gen', 'generated'])
const ignoredFilePatterns = [/\.test\./, /\.spec\./, /\.stories\./, /\.probe\./, /\.gen\./]
// Attributes whose literal text reaches a user. Structural attributes (className,
// id, testID, nativeID, role, href, to, name, type, key, lang, style, data-*) are
// deliberately absent — they are not localizable copy.
const userFacingAttributes = new Set([
  'title',
  'placeholder',
  'alt',
  'label',
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'accessibilityLabel',
  'accessibilityHint',
])
const optOutToken = 'i18n-ignore'
const hasLetter = (text) => /\p{L}/u.test(text)

const isIgnoredPath = (rel) => rel.split(sep).some((segment) => ignoredSegments.has(segment))
const isIgnoredFile = (rel) => ignoredFilePatterns.some((pattern) => pattern.test(rel))

const files = []
const walk = (dir) => {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = relative(repoRoot, full)
    if (isIgnoredPath(rel)) continue
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full)
    else if (stat.isFile() && scanExtensions.has(extname(full)) && !isIgnoredFile(rel)) {
      files.push({ path: rel, text: readFileSync(full, 'utf8') })
    }
  }
}

if (probe) {
  // One synthetic file proves both halves of the rule at once: the bare JSX copy
  // must be caught, while every documented non-UI construct beside it stays quiet.
  files.push({
    path: 'apps/web/src/__raw_string_probe__.tsx',
    text: [
      "import { m } from '@cosimosi/i18n'",
      "const note = 'internal diagnostic string' // a developer log, not user-facing",
      'export function RawStringProbe() {',
      '  return (',
      '    <section className="raw probe panel" data-state="open">',
      '      {/* i18n-ignore: intentional placeholder */}',
      '      <h2 title="ignored by opt-out">ignored heading</h2>',
      '      <p>{m.app_greeting()}</p>',
      '      <span>{note}</span>',
      '      <h1>UNLOCALIZED PROBE COPY</h1>',
      '    </section>',
      '  )',
      '}',
      '',
    ].join('\n'),
  })
} else {
  for (const root of roots) walk(join(repoRoot, root))
}

const violations = []

for (const file of files) {
  const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const lines = file.text.split('\n')

  const lineOptedOut = (pos) => {
    const { line } = source.getLineAndCharacterOfPosition(pos)
    return (lines[line] ?? '').includes(optOutToken) || (lines[line - 1] ?? '').includes(optOutToken)
  }
  const report = (pos, message) => {
    if (lineOptedOut(pos)) return
    const { line, character } = source.getLineAndCharacterOfPosition(pos)
    violations.push(`${file.path}:${line + 1}:${character + 1}  ${message}`)
  }

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const value = node.text.trim()
      if (value && hasLetter(value)) {
        report(node.getStart(source), `raw JSX text "${truncate(value)}" — use a message function (m.*)`)
      }
    } else if (ts.isJsxAttribute(node) && userFacingAttributes.has(node.name.getText(source))) {
      // Catch both `title="raw"` and the `title={"raw"}` expression-wrapped form.
      const literal = attributeStringLiteral(node.initializer)
      if (literal && hasLetter(literal.text)) {
        report(
          literal.getStart(source),
          `raw user-facing attribute ${node.name.getText(source)}="${truncate(literal.text)}" — use a message function (m.*)`,
        )
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

function attributeStringLiteral(initializer) {
  if (!initializer) return undefined
  if (ts.isStringLiteral(initializer)) return initializer
  if (ts.isJsxExpression(initializer) && initializer.expression && ts.isStringLiteral(initializer.expression)) {
    return initializer.expression
  }
  return undefined
}

function truncate(value) {
  const collapsed = value.replace(/\s+/g, ' ')
  return collapsed.length > 50 ? `${collapsed.slice(0, 47)}…` : collapsed
}

section('raw user-facing string lint')

if (probe) {
  const probeHits = violations.filter((v) => v.includes('__raw_string_probe__'))
  if (probeHits.length !== 1 || !probeHits[0].includes('UNLOCALIZED PROBE COPY')) {
    for (const hit of probeHits) console.error(`- ${hit}`)
    fail(`probe expected exactly 1 hit (the bare JSX copy), got ${probeHits.length}`)
  }
  ok('probe caught the deliberate UI string and ignored the documented non-UI cases')
} else if (violations.length) {
  for (const violation of violations) console.error(`- ${violation}`)
  fail(`${violations.length} raw user-facing string(s) found; route copy through message functions or mark with ${optOutToken}`)
} else {
  ok(`scanned ${files.length} UI component file(s); no raw user-facing strings`)
}
