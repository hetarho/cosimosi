#!/usr/bin/env node
// Reason-registry parity: every stable reason the backend can put on the wire is registered on both
// sides of the seam — the FE `ERROR_REASONS` union and the policy §2 table.
//
// An UNMAPPED reason deliberately falls back to the coarse Connect-code copy. That is the right
// default, but it also means a reason nobody registered is invisible: no test fails, no lint fails,
// and the surface quietly shows a sentence written for a different failure. So the rule here is
// membership only — bespoke FE copy stays optional by design, and a gate demanding it would fight
// that. The registry contract lives in spec/policy/platform/errors.md §2.
//
//   node scripts/check-error-reasons.mjs
//   node scripts/check-error-reasons.mjs --probe   self-test that the parser and the rule fire
//
// The probe runs the pure functions over in-memory fixtures. No file is written anywhere, so this
// scanner is hermetic by construction and needs none of the `.probe-ws-*` workspace machinery the
// ESLint-config probes require (quality-gates §Probe hermeticity).

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { fail, note, ok, repoRoot, section } from './lib.mjs'

const RPC_DIR = 'apps/api/internal'
const FE_REGISTRY = 'packages/errors/src/core.ts'
const POLICY_TABLE = 'spec/policy/platform/errors.md'

// Reasons the FE registry owns without any `reasons.go` emitting them: `apperr`'s platform
// fallbacks. `PLATFORM_<CONNECT_CODE>` is built at runtime from the code name, so the registry
// carries the three named ones and the family is generated rather than enumerated. Listed here so
// the check stays one-directional on purpose — a strict two-way diff would fail on all of these.
const PLATFORM_OWNED = new Set([
  'INTERNAL',
  'UNKNOWN',
  'PLATFORM_UNAUTHENTICATED',
  'PLATFORM_AUTH_VERIFIER_UNAVAILABLE',
  'PLATFORM_ACCOUNT_WITHDRAWN',
])

/**
 * Reason strings a context's `rpc/reasons.go` declares. Matches the `reasonX = "REASON"` constant
 * form the per-context registries use, so an ad-hoc string built at a call site is deliberately not
 * counted — the constant is required to live beside the mapping it names.
 */
export function emittedReasons(source) {
  const found = []
  for (const match of source.matchAll(/\breason\w*\s*=\s*"([A-Z][A-Z0-9_]*)"/g))
    found.push(match[1])
  return found
}

/**
 * Members of the `ERROR_REASONS` object literal — NOT every uppercase string in the file. The
 * `codeName()` helper below it returns bare code names (`NOT_FOUND`, `ABORTED`, …) that are not
 * registry entries; counting those would silently mark an unregistered reason as present.
 */
export function registeredReasons(source) {
  const start = source.indexOf('export const ERROR_REASONS = {')
  if (start === -1) return null
  const end = source.indexOf('} as const', start)
  if (end === -1) return null
  const body = source.slice(start, end)
  const found = []
  for (const match of body.matchAll(/^\s*\w+:\s*'([A-Z][A-Z0-9_]*)',/gm)) found.push(match[1])
  return found
}

/** Reasons named in the §2 registry table. One cell may list several, comma-separated. */
export function documentedReasons(markdown) {
  const found = []
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('|')) continue
    const cell = line.split('|')[1]
    if (!cell) continue
    for (const match of cell.matchAll(/`([A-Z][A-Z0-9_]*)`/g)) found.push(match[1])
  }
  return found
}

/** The rule: every emitted reason is registered on both sides. Returns one problem per gap. */
export function parityProblems({ emitted, registered, documented }) {
  const problems = []
  const inRegistry = new Set(registered)
  const inPolicy = new Set(documented)
  for (const [reason, origin] of emitted) {
    if (!inRegistry.has(reason)) {
      problems.push(`${reason} (${origin}) is not in ERROR_REASONS (${FE_REGISTRY})`)
    }
    if (!inPolicy.has(reason)) {
      problems.push(`${reason} (${origin}) is not in the §2 reason registry (${POLICY_TABLE})`)
    }
  }
  return problems
}

section('error-reason registry parity')

if (process.argv.includes('--probe')) {
  runProbe()
} else {
  runCheck()
}

function runCheck() {
  const emitted = collectEmitted()
  if (emitted.length === 0) fail(`no reason constants found under ${RPC_DIR}/*/rpc/reasons.go`)

  const registered = registeredReasons(readFileSync(join(repoRoot, FE_REGISTRY), 'utf8'))
  if (!registered) fail(`could not read the ERROR_REASONS object literal in ${FE_REGISTRY}`)
  const documented = documentedReasons(readFileSync(join(repoRoot, POLICY_TABLE), 'utf8'))

  const problems = parityProblems({ emitted, registered, documented })
  if (problems.length > 0) {
    for (const problem of problems) console.error(`  \x1b[31m✗\x1b[0m ${problem}`)
    fail(
      `${problems.length} reason(s) are not registered on both sides. Add the key to ERROR_REASONS ` +
        `and the row to ${POLICY_TABLE} §2. Bespoke FE copy stays optional by design.`,
    )
  }

  const unmatched = [...new Set(registered)].filter(
    (reason) => !PLATFORM_OWNED.has(reason) && !emitted.some(([name]) => name === reason),
  )
  if (unmatched.length > 0) {
    note(
      `registry entries no reasons.go emits (stale, or newly platform-owned): ${unmatched.join(', ')}`,
    )
  }
  ok(`${emitted.length} emitted reason(s) are registered in ERROR_REASONS and the §2 table`)
}

function collectEmitted() {
  const emitted = []
  const contexts = join(repoRoot, RPC_DIR)
  for (const context of readdirSync(contexts, { withFileTypes: true })) {
    if (!context.isDirectory()) continue
    const path = join(contexts, context.name, 'rpc', 'reasons.go')
    let source
    try {
      source = readFileSync(path, 'utf8')
    } catch {
      continue
    }
    for (const reason of emittedReasons(source)) {
      emitted.push([reason, `${context.name}/rpc/reasons.go`])
    }
  }
  return emitted
}

function runProbe() {
  const goFixture = `package rpc

const (
\treasonRegistered   = "CTX_REGISTERED"
\treasonUnregistered = "CTX_UNREGISTERED"
)
`
  // The trap this parser exists to avoid: a member of the union, and a bare code name that only
  // LOOKS like one because it sits in the same file.
  const tsFixture = `export const ERROR_REASONS = {
  ctxRegistered: 'CTX_REGISTERED',
} as const

function codeName(code: Code): string {
  switch (code) {
    case Code.NotFound:
      return 'CTX_UNREGISTERED'
  }
}
`
  const mdFixture = `| Reason(s) | Domain | Connect code | FE |
| --- | --- | --- | --- |
| \`CTX_REGISTERED\` | ctx | Internal | fallback |
`

  const emittedNames = emittedReasons(goFixture)
  if (emittedNames.join(',') !== 'CTX_REGISTERED,CTX_UNREGISTERED') {
    fail(`the reasons.go parser missed a constant: got [${emittedNames.join(', ')}]`)
  }

  const registered = registeredReasons(tsFixture)
  if (registered?.join(',') !== 'CTX_REGISTERED') {
    fail(
      `the ERROR_REASONS parser must read the object literal ONLY; it returned [${registered?.join(', ')}] ` +
        `— a codeName() string was counted as a registry member, which is exactly how an unregistered ` +
        `reason hides`,
    )
  }

  if (documentedReasons(mdFixture).join(',') !== 'CTX_REGISTERED') {
    fail('the §2 table parser did not read the reason cell')
  }

  const emitted = emittedNames.map((name) => [name, 'ctx/rpc/reasons.go'])
  const problems = parityProblems({
    emitted,
    registered,
    documented: documentedReasons(mdFixture),
  })
  const missingBoth = problems.filter((problem) => problem.startsWith('CTX_UNREGISTERED'))
  if (missingBoth.length !== 2) {
    fail(`the offender must fail on BOTH sides; reported ${missingBoth.length} problem(s)`)
  }
  if (problems.some((problem) => problem.startsWith('CTX_REGISTERED'))) {
    fail('a fully registered reason must not be reported')
  }

  ok(
    'an unregistered reason fails on both sides; a registered one passes; codeName() is not a member',
  )
}
