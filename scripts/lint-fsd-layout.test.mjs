import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, test } from 'node:test'

import {
  compareDuplicationBaseline,
  findFsdLayoutProblems,
  findWorkspacePackageCycles,
  measureSharedUiLogic,
} from './lint-fsd-layout.mjs'

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

test('rejects a product package cycle and accepts a consumer composition DAG', () => {
  const root = fixture()
  const manifest = (name, dependencies) =>
    put(
      root,
      `packages/${name}/package.json`,
      JSON.stringify({
        name: `@cosimosi/${name}`,
        dependencies: Object.fromEntries(
          dependencies.map((d) => [`@cosimosi/${d}`, 'workspace:*']),
        ),
      }),
    )
  manifest('auth', ['store'])
  manifest('store', ['auth'])
  assert.ok(
    findWorkspacePackageCycles(root).some((p) =>
      p.includes('auth → @cosimosi/store → @cosimosi/auth'),
    ),
  )
  manifest('auth', [])
  assert.deepEqual(findWorkspacePackageCycles(root), [])
})

for (const platform of ['web', 'mobile']) {
  test(`${platform} enforces slice public APIs, renderer ownership and UI segments`, () => {
    const root = fixture()
    const base = `apps/${platform}/src`
    put(root, `${base}/entities/item/model/private.ts`)
    put(root, `${base}/entities/item/index.ts`, 'export const item = 1')
    put(
      root,
      `${base}/features/edit/model/private.ts`,
      "import { value } from '../../../entities/item/model/private.ts'; export { value }",
    )
    put(
      root,
      `${base}/features/edit/ui/Public.ts`,
      "import { item } from '../../../entities/item/index.ts'; export { item }",
    )
    put(
      root,
      `${base}/features/edit/ui/Renderer.ts`,
      "import { Vector3 } from 'three'; export const vector = new Vector3()",
    )
    put(root, `${base}/pages/design/lib/Panel.tsx`, 'export const Panel = () => <div />')
    const problems = findFsdLayoutProblems(root)
    assert.ok(problems.some((p) => p.includes('private slice import')))
    assert.ok(problems.some((p) => p.includes('renderer imports')))
    assert.ok(problems.some((p) => p.includes('platform JSX')))
    assert.ok(!problems.some((p) => p.includes('Public.ts')))
  })
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

test('rejects a slice index that re-exports a package symbol, on both platforms', () => {
  const root = fixture()
  for (const app of ['web', 'mobile']) {
    put(
      root,
      `apps/${app}/src/widgets/recall-flow/index.ts`,
      "export { RecallFlowSheet } from './ui/RecallFlowSheet.tsx'\nexport { useRecallFlowController as useController } from '@cosimosi/universe/react/flows'\n",
    )
    put(
      root,
      `apps/${app}/src/widgets/recall-flow/ui/RecallFlowSheet.tsx`,
      'export const RecallFlowSheet = 1\n',
    )
  }
  put(root, 'apps/web/src/features/probe/index.ts', "export * from '@cosimosi/universe'\n")
  put(root, 'apps/web/src/features/probe/ui/Own.ts', 'export const own = 1\n')
  put(root, 'apps/mobile/src/features/own/index.ts', "export { own } from './ui/Own.ts'\n")
  put(
    root,
    'apps/mobile/src/features/own/ui/Own.ts',
    "export { cn } from '@cosimosi/ui'\nexport const own = 1\n",
  )
  const barrels = findFsdLayoutProblems(root).filter((problem) =>
    problem.includes('a slice index re-exports'),
  )
  assert.equal(barrels.length, 3, barrels.join('\n'))
  assert.ok(barrels.some((problem) => problem.includes('apps/web/src/features/probe/index.ts')))
})

test('only tests import the flow drafts test entry', () => {
  const root = fixture()
  const seed =
    "import { useRecallDraftStore } from '@cosimosi/universe/testing'\nexport const seed = useRecallDraftStore\n"
  put(root, 'apps/web/src/widgets/recall-flow/ui/Seed.ts', seed)
  put(root, 'apps/web/src/widgets/recall-flow/ui/Seed.test.ts', seed)
  const problems = findFsdLayoutProblems(root).filter((problem) =>
    problem.includes('@cosimosi/universe/testing is for tests only'),
  )
  assert.deepEqual(problems.length, 1, problems.join('\n'))
  assert.ok(problems[0].includes('widgets/recall-flow/ui/Seed.ts'))
})

test('rejects a paid session or paid request in any app ui file', () => {
  const root = fixture()
  put(
    root,
    'apps/web/src/widgets/star-detail/ui/GistViewSheet.tsx',
    "import { createPaidActionSession, requestViewSemantic as read } from '@cosimosi/universe'; export const s = [createPaidActionSession, read];",
  )
  put(
    root,
    'apps/mobile/src/features/probe-flow/ui/Probe.tsx',
    "import { requestRecallDiaryStars } from '@cosimosi/universe'; export const r = requestRecallDiaryStars;",
  )
  put(
    root,
    'apps/web/src/widgets/star-detail/ui/Bound.tsx',
    "import { useGistViewController } from '@cosimosi/universe/react/flows'; import type { PaidActionAttempt } from '@cosimosi/universe'; export const c = useGistViewController; export type A = PaidActionAttempt;",
  )
  const paid = findFsdLayoutProblems(root).filter((problem) =>
    problem.includes('belong to its package controller'),
  )
  assert.equal(paid.length, 2)
  assert.ok(paid.some((problem) => problem.includes('star-detail/ui/GistViewSheet.tsx')))
})

test('a copy that differs only in braces, parentheses, semicolons and commas is still a duplicate', () => {
  const root = fixture()
  put(
    root,
    'apps/web/src/features/probe/model/guard.ts',
    'export function guard(value: number) {\n  if (value > 1) return [value, value];\n  return (value)\n}\n',
  )
  put(
    root,
    'apps/mobile/src/features/probe/model/guard.ts',
    'export function guard(value: number) {\n  if (value > 1) {\n    return [value, value,]\n  }\n  return value;\n}\n',
  )
  const problems = findFsdLayoutProblems(root)
  assert.ok(
    problems.some((problem) =>
      problem.includes('features/probe/model/guard.ts — normalized-equivalent'),
    ),
    problems.join('\n'),
  )
})

test('the shared-logic ratchet counts identical logic lines in forked ui files and refuses growth', () => {
  const root = fixture()
  const controller = (marker, view) =>
    `${marker}\nimport { useState } from 'react'\nexport function Panel() {\n  const [open, setOpen] = useState(false)\n  const toggle = () => setOpen(!open)\n  if (!open) {\n    return null\n  }\n  return ${view}\n}\n`
  put(
    root,
    'apps/web/src/widgets/probe/ui/Panel.tsx',
    controller("import { createPortal } from 'react-dom'", '<div onClick={toggle} />'),
  )
  put(
    root,
    'apps/mobile/src/widgets/probe/ui/Panel.tsx',
    controller("import { View } from 'react-native'", '<View onTouchEnd={toggle} />'),
  )
  const measured = measureSharedUiLogic(root)
  assert.ok(measured.files['widgets/probe/ui/Panel.tsx'] >= 4)
  assert.equal(compareDuplicationBaseline(measured, { total: measured.total, files: {} }).length, 0)
  assert.equal(compareDuplicationBaseline(measured, { total: 0, files: {} }).length, 1)
})
