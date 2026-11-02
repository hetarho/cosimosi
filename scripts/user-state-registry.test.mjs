// User-state reset inventory (CLIENT-11). Every package-level store and every mutable module `let`
// under packages/*/src is either reached from a reset seam or listed as device-scoped in
// device-scoped-state.json, so a new store cannot be forgotten on a scope change. "Reached" is
// static: the checker follows every top-level function and value the seam files reference, through
// package entries and re-exports, and a store or `let` that walk touches counts as cleared. The
// walk does not descend into a store's own creator, so a store is cleared only by a seam that names it.

import assert from 'node:assert/strict'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { afterEach, test } from 'node:test'
import ts from 'typescript'

import { repoRoot } from './lib.mjs'

const SEAM_FILES = [
  'apps/web/src/app/providers/user-state-resets.ts',
  'apps/mobile/src/app/providers/user-state-resets.ts',
  'packages/auth/src/user-state-reset.ts',
]
const SOURCE = /\.(ts|tsx|js)$/
const TEST = /\.(test|spec)\.[jt]sx?$/

const portable = (root, file) => relative(root, file).split(sep).join('/')

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(path)
    return SOURCE.test(entry.name) && !TEST.test(entry.name) ? [path] : []
  })
}

// A zustand store: a top-level const whose initializer is a `create(...)` / `createStore(...)` call,
// including the curried `create<T>()(...)` form.
function isStoreInitializer(node) {
  let call = node
  while (call && ts.isCallExpression(call)) {
    if (ts.isIdentifier(call.expression) && /^create(Store)?$/.test(call.expression.text))
      return true
    call = call.expression
  }
  return false
}

// Every package-level store and mutable module `let`, keyed `path#name`.
function packageState(root) {
  const packages = join(root, 'packages')
  const state = new Map()
  for (const pkg of readdirSync(packages, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue
    const src = join(packages, pkg.name, 'src')
    let files
    try {
      files = walk(src)
    } catch {
      continue
    }
    for (const file of files) {
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest)
      for (const statement of source.statements) {
        if (!ts.isVariableStatement(statement)) continue
        const mutable = (statement.declarationList.flags & ts.NodeFlags.Let) !== 0
        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name)) continue
          if (!mutable && !isStoreInitializer(declaration.initializer)) continue
          state.set(`${portable(root, file)}#${declaration.name.text}`, mutable ? 'let' : 'store')
        }
      }
    }
  }
  return state
}

const topLevel = (declaration) =>
  (ts.isFunctionDeclaration(declaration) && ts.isSourceFile(declaration.parent)) ||
  (ts.isVariableDeclaration(declaration) &&
    ts.isVariableStatement(declaration.parent.parent) &&
    ts.isSourceFile(declaration.parent.parent.parent))

// Every top-level store, `let` or value the seam files reach, keyed `path#name`.
function reachedFromSeams(root, seamFiles) {
  const program = ts.createProgram(
    seamFiles.map((file) => join(root, file)),
    {
      allowJs: true,
      allowImportingTsExtensions: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      types: [],
    },
  )
  const checker = program.getTypeChecker()
  const reached = new Set()
  const visited = new Set()
  const queue = seamFiles.map((file) => program.getSourceFile(join(root, file)))
  assert.ok(
    queue.every(Boolean),
    `a seam file is missing from the program: ${seamFiles.join(', ')}`,
  )
  const follow = (identifier) => {
    let symbol = checker.getSymbolAtLocation(identifier)
    if (!symbol) return
    if (symbol.flags & ts.SymbolFlags.Alias) {
      try {
        symbol = checker.getAliasedSymbol(symbol)
      } catch {
        return
      }
    }
    for (const declaration of symbol.declarations ?? []) {
      const file = declaration.getSourceFile()
      if (file.isDeclarationFile || file.fileName.includes('/node_modules/')) continue
      if (!file.fileName.startsWith(root) || !topLevel(declaration)) continue
      if (visited.has(declaration)) continue
      visited.add(declaration)
      reached.add(`${portable(root, file.fileName)}#${declaration.name?.text}`)
      // A store is cleared by the seam that names it; following its creator would count every
      // module its actions touch as cleared too.
      if (ts.isVariableDeclaration(declaration) && isStoreInitializer(declaration.initializer))
        continue
      queue.push(declaration)
    }
  }
  while (queue.length > 0) {
    const node = queue.pop()
    const visit = (child) => {
      if (ts.isIdentifier(child)) follow(child)
      ts.forEachChild(child, visit)
    }
    ts.forEachChild(node, visit)
  }
  return reached
}

function deviceScoped(root) {
  const listed = JSON.parse(readFileSync(join(root, 'scripts/device-scoped-state.json'), 'utf8'))
  return listed.state
}

export function findUnresetState(checkout, seamFiles, listed) {
  // The checker reports resolved modules by real path, so the root must be one too.
  const root = realpathSync(checkout)
  const state = packageState(root)
  const reached = reachedFromSeams(root, seamFiles)
  const wholeFiles = Object.keys(listed)
    .filter((key) => key.endsWith('#*'))
    .map((key) => key.slice(0, -2))
  const listedFor = (key) => key in listed || wholeFiles.includes(key.split('#')[0])
  const problems = []
  for (const [key, kind] of state) {
    if (reached.has(key) && key in listed)
      problems.push(`${key} — listed as device-scoped, but a reset seam clears it`)
    if (!reached.has(key) && !listedFor(key))
      problems.push(
        `${key} — a package-level ${kind} no reset seam clears; clear it in its package's seam or list it in scripts/device-scoped-state.json`,
      )
  }
  for (const key of Object.keys(listed)) {
    const names = key.endsWith('#*')
      ? [...state.keys()].some((name) => name.startsWith(key.slice(0, -1)))
      : state.has(key)
    if (!names)
      problems.push(`${key} — listed as device-scoped, but no such package-level state exists`)
  }
  return problems
}

test('every package-level store and mutable module value is reset or device-scoped', () => {
  assert.deepEqual(findUnresetState(repoRoot, SEAM_FILES, deviceScoped(repoRoot)), [])
})

test('both apps list the same product legs in the same order, then a locale leg', () => {
  const legs = (file) => {
    const source = readFileSync(join(repoRoot, file), 'utf8')
    const product = source.match(/_USER_STATE_RESETS = \[([\s\S]*?)\] as const/)
    const locale = source.match(/_LOCALE_RESET = \{ name: '([^']+)'/)
    assert.ok(product && locale, `${file} declares its product legs and its locale leg`)
    return {
      product: [...product[1].matchAll(/name: '([^']+)'/g)].map((match) => match[1]),
      locale: locale[1],
    }
  }
  const web = legs(SEAM_FILES[0])
  const mobile = legs(SEAM_FILES[1])
  assert.deepEqual(mobile.product, web.product)
  assert.equal(web.locale, 'locale')
  assert.equal(mobile.locale, 'locale')
})

const fixtures = []
afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true })
})

function put(root, path, content) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}

test('probe: a new store or module let that no seam clears fails the inventory', () => {
  const root = mkdtempSync(join(tmpdir(), 'cosimosi-user-state-'))
  fixtures.push(root)
  put(
    root,
    'packages/probe/src/stores.ts',
    `declare function create<T>(): (init: unknown) => T
export const useClearedStore = create<{ clear(): void }>()(() => ({}))
export const useForgottenStore = create<{ clear(): void }>()(() => ({}))
let counted = 0
let forgotten = 0
let device = 0
export function resetCounted(): void {
  counted = 0
}
`,
  )
  put(
    root,
    'packages/probe/src/user-state-reset.ts',
    `import { resetCounted, useClearedStore } from './stores.ts'
export function resetProbeUserState(): void {
  useClearedStore.getState().clear()
  resetCounted()
}
`,
  )
  const problems = findUnresetState(root, ['packages/probe/src/user-state-reset.ts'], {
    'packages/probe/src/stores.ts#device': 'a probe value that outlives a scope change',
    'packages/probe/src/stores.ts#gone': 'a listing that names nothing',
  })
  assert.deepEqual(
    problems.map((problem) => problem.split(' — ')[0]),
    [
      'packages/probe/src/stores.ts#useForgottenStore',
      'packages/probe/src/stores.ts#forgotten',
      'packages/probe/src/stores.ts#gone',
    ],
  )
})
