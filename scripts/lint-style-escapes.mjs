#!/usr/bin/env node
// Style-escape lint: product slices must express appearance through design tokens, never through a
// literal of their own. One raw `#0b1020` or `shadow-[0_0_20px_rgba(...)]` in a feature is enough to
// leave a stale patch behind when the theme changes — the escape is invisible to `pnpm gen:tokens`,
// to the contrast suite, and to `[data-theme]`. Keeping the slices literal-free is what makes
// adding a theme a data change in packages/ui and nothing else.
//
// Scope: `features`, `widgets`, and `pages` in both apps — the layers that compose the product.
// `packages/ui` is deliberately NOT scanned here; it is the design system, and its own literals are
// gated by packages/ui/src/palette.test.ts (colour must live in the palette layer).
//
// Flagged:
//   1. raw colour literals — #rrggbb, rgb()/rgba(), hsl()/hsla(), oklch()/oklab();
//   2. Tailwind arbitrary values that hardcode geometry or colour — text-[10px], shadow-[...],
//      bg-[#...], w-[327px]. The named scales and token utilities cover the language.
// Arbitrary values carrying no measurement or colour (grid templates, aspect ratios, selectors like
// `[&_svg]:size-4`) stay allowed — they are structure, not appearance.
//
// A line carrying `style-escape-ignore` with a reason opts out.
//
//   node scripts/lint-style-escapes.mjs           scan the product slices
//   node scripts/lint-style-escapes.mjs --probe   self-test the catch + ignore rules

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'
import { fail, ok, repoRoot, section } from './lib.mjs'

const probe = process.argv.includes('--probe')

const LAYERS = ['features', 'widgets', 'pages']
const roots = ['apps/web/src', 'apps/mobile/src'].flatMap((app) =>
  LAYERS.map((layer) => `${app}/${layer}`),
)
const scanExtensions = new Set(['.ts', '.tsx', '.css'])
const ignoredSegments = new Set(['node_modules', 'dist', 'build', 'coverage', 'gen', 'generated'])
const ignoredFilePatterns = [/\.test\./, /\.spec\./, /\.stories\./, /\.gen\./]
const optOutToken = 'style-escape-ignore'

// The lookbehind is `[a-zA-Z]`, not `\b`: inside a Tailwind arbitrary value the separator is an
// underscore (`shadow-[0_0_20px_rgba(...)]`), which `\b` treats as part of the word and skips.
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|(?<![a-zA-Z])(?:rgba?|hsla?|oklch|oklab)\(/

// Every Tailwind arbitrary value on a line, with the utility it belongs to.
const ARBITRARY = /(?<![\w:[-])((?:[a-z][a-z0-9]*-)*)\[([^\]]+)\]/g
// A value that pins a length or a colour — appearance the token scale already owns.
const PINNED_APPEARANCE = /#[0-9a-fA-F]{3,8}|\d(?:\.\d+)?(?:px|rem|em)\b|\brgba?\(/
// Utilities whose arbitrary value is layout STRUCTURE, not appearance: a grid track list or an
// aspect ratio has no token-scale equivalent to reach for, so a literal there is the intended way
// to write it — and it carries no colour or spacing the theme could ever restyle.
const STRUCTURAL_UTILITIES = /^(?:grid-(?:cols|rows|area)-|aspect-|col-|row-|order-)$/

function arbitraryEscape(line) {
  for (const [, prefix, value] of line.matchAll(ARBITRARY)) {
    // A bracket opening on `&`, `@`, or an attribute is a variant selector, not a value.
    if (/^[&@[]/.test(value)) continue
    if (STRUCTURAL_UTILITIES.test(prefix)) continue
    if (PINNED_APPEARANCE.test(value)) return true
  }
  return false
}

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
  // One synthetic file proves both halves at once: the two escapes must be caught, while the
  // token-driven lines and the opted-out line beside them stay quiet.
  files.push({
    path: 'apps/web/src/features/__style_escape_probe__/ui/Probe.tsx',
    text: [
      'export function Probe() {',
      '  return (',
      '    <div className="rounded-md bg-surface p-4 text-sm text-text-muted shadow-md">',
      '      <span className="text-[10px]">CAUGHT ARBITRARY</span>',
      '      <span style={{ color: "#ff0000" }}>CAUGHT COLOR</span>',
      `      <span className="w-[3px]">allowed</span> {/* ${optOutToken}: hairline rule */}`,
      '      <div className="grid-cols-[9rem_1fr] [&_svg]:size-4 aspect-4/3" />',
      '    </div>',
      '  )',
      '}',
    ].join('\n'),
  })
} else {
  for (const root of roots) walk(join(repoRoot, root))
}

const violations = []
for (const file of files) {
  file.text.split('\n').forEach((line, index) => {
    if (line.includes(optOutToken)) return
    const kind = RAW_COLOR.test(line)
      ? 'raw colour'
      : arbitraryEscape(line)
        ? 'arbitrary value'
        : null
    if (kind) violations.push(`${file.path}:${index + 1} ${kind} — ${line.trim()}`)
  })
}

section('style-escape lint')

if (probe) {
  const hits = violations.filter((v) => v.includes('__style_escape_probe__'))
  const caught = hits.filter((v) => v.includes('CAUGHT')).length
  if (hits.length !== 2 || caught !== 2) {
    for (const hit of hits) console.error(`- ${hit}`)
    fail(`probe expected exactly 2 hits (the arbitrary value + the raw colour), got ${hits.length}`)
  }
  ok('probe caught the deliberate escapes and ignored the token-driven and opted-out lines')
} else if (violations.length) {
  for (const violation of violations) console.error(`- ${violation}`)
  fail(
    `${violations.length} style escape(s) in product slices; express appearance through @cosimosi/ui tokens, or mark the line with ${optOutToken} and a reason`,
  )
} else {
  ok(`scanned ${files.length} slice file(s) across ${roots.length} layer root(s); no style escapes`)
}
