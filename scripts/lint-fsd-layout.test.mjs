import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, test } from 'node:test'

import { findFsdLayoutProblems } from './lint-fsd-layout.mjs'

const roots = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cosimosi-fsd-'))
  roots.push(root)
  return root
}

function put(root, path, source = 'export const value = 1\n') {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, source)
}

test('rejects a mobile product screen under app/navigation/screens', () => {
  const root = fixture()
  put(root, 'apps/mobile/src/app/navigation/screens/UniverseScreen.tsx')

  const problems = findFsdLayoutProblems(root)

  assert.ok(problems.some((problem) => problem.includes('product composition')))
})

test('allows the neutral mobile boot shell under app/navigation/screens', () => {
  const root = fixture()
  put(root, 'apps/mobile/src/app/navigation/screens/BootScreen.tsx')

  assert.deepEqual(findFsdLayoutProblems(root), [])
})

test('rejects an unknown app-layer segment, not just a loose file', () => {
  const root = fixture()
  put(root, 'apps/mobile/src/app/diagnostics/DiagnosticsScreen.tsx')

  const problems = findFsdLayoutProblems(root)

  assert.ok(problems.some((problem) => problem.includes('unknown app-layer segment')))
})

test("allows every documented app-layer segment, and no other app's router name", () => {
  const root = fixture()
  // Distinct file names per app: an identical same-relative pure module is a promote-on-reuse
  // violation of its own, and this test is about the segment set alone.
  for (const segment of ['providers', 'navigation', 'model', 'styles']) {
    put(root, `apps/mobile/src/app/${segment}/native-thing.ts`, `export const m${segment} = 1\n`)
  }
  for (const segment of ['providers', 'routes', 'model', 'styles']) {
    put(root, `apps/web/src/app/${segment}/dom-thing.ts`, `export const w${segment} = 2\n`)
  }

  assert.deepEqual(findFsdLayoutProblems(root), [])

  // The router segment's name differs per platform and that difference is the contract, so borrowing
  // the other app's name is still a violation.
  const borrowed = fixture()
  put(borrowed, 'apps/mobile/src/app/routes/router.ts')
  assert.ok(
    findFsdLayoutProblems(borrowed).some((problem) =>
      problem.includes('unknown app-layer segment'),
    ),
  )
})

test('leaves a crashed probe fixture in the app layer alone', () => {
  const root = fixture()
  put(root, 'apps/mobile/src/app/.probe-ws-leftover/thing.ts')

  assert.deepEqual(findFsdLayoutProblems(root), [])
})

test('rejects a byte-identical same-relative pure module in both apps', () => {
  const root = fixture()
  put(root, 'apps/web/src/features/example/model/example-store.ts')
  put(root, 'apps/mobile/src/features/example/model/example-store.ts')

  const problems = findFsdLayoutProblems(root)

  assert.ok(problems.some((problem) => problem.includes('byte-identical pure module')))
})

test('rejects a duplicated provider from the app layer', () => {
  const root = fixture()
  put(root, 'apps/web/src/app/providers/locale-bootstrap.ts')
  put(root, 'apps/mobile/src/app/providers/locale-bootstrap.ts')

  const problems = findFsdLayoutProblems(root)

  assert.ok(problems.some((problem) => problem.includes('pure module')))
})

// R4 reaches `ui` too, which is where a platform-pure hook shell most plausibly lands — and where a
// byte-identical 56-line host once shipped with this gate green.
test('rejects a platform-pure ui module duplicated in both apps', () => {
  const root = fixture()
  const body = `import { useEffect, useRef, useState } from 'react'

export function NoticeHost({ push }) {
  const [seen, setSeen] = useState(0)
  const last = useRef(null)
  useEffect(() => {
    if (last.current === seen) return
    last.current = seen
    push(seen)
  }, [seen, push])
  return null
}
`
  put(root, 'apps/web/src/features/notice/ui/NoticeHost.tsx', body)
  put(root, 'apps/mobile/src/features/notice/ui/NoticeHost.tsx', body)

  const problems = findFsdLayoutProblems(root)

  assert.ok(problems.some((problem) => problem.includes('NoticeHost.tsx')))
})

test('allows a ui pair that genuinely differs per platform', () => {
  const root = fixture()
  put(
    root,
    'apps/web/src/features/notice/ui/NoticeBanner.tsx',
    `export function NoticeBanner({ message }) {
  const trimmed = message.trim()
  if (!trimmed) return null
  return <div className="banner">{trimmed}</div>
}
`,
  )
  put(
    root,
    'apps/mobile/src/features/notice/ui/NoticeBanner.tsx',
    `import { Text } from 'react-native'

export function NoticeBanner({ message }) {
  const trimmed = message.trim()
  if (!trimmed) return null
  return <Text>{trimmed}</Text>
}
`,
  )

  assert.deepEqual(findFsdLayoutProblems(root), [])
})

test('allows an identical ui shell that only wires an app-local dependency', () => {
  const root = fixture()
  // Two apps injecting their own copy resolver into one packaged hook end up with the same few
  // lines. There is nothing left to promote, so flagging it would demand a change that cannot be
  // made — the line R4 draws is at behavior, not at similarity.
  const shell = `import { useNotice } from '@cosimosi/achievement/react'
import { useToastQueue } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

export function NoticeHost() {
  const queue = useToastQueue()
  useNotice({ queue, formatNotice: (id) => m.notice({ id }) })
  return null
}
`
  put(root, 'apps/web/src/features/notice/ui/NoticeHost.tsx', shell)
  put(root, 'apps/mobile/src/features/notice/ui/NoticeHost.tsx', shell)

  assert.deepEqual(findFsdLayoutProblems(root), [])
})

test('rejects normalized-equivalent modules whose exported identifier was renamed', () => {
  const root = fixture()
  put(
    root,
    'apps/web/src/app/providers/locale-bootstrap.ts',
    'export function LocaleBootstrap() { return null }\n',
  )
  put(
    root,
    'apps/mobile/src/app/providers/locale-bootstrap.ts',
    'export function MobileLocaleBootstrap() { return null }\n',
  )

  const problems = findFsdLayoutProblems(root)

  assert.ok(problems.some((problem) => problem.includes('normalized-equivalent pure module')))
})
