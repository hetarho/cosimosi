import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

// The design system is domain-agnostic: it must not reach into product domain, the
// data cache, the transport client, or even the i18n message catalogue — copy
// arrives through props. Importing any of these would let a primitive embed
// product strings or touch domain/cache state.
const FORBIDDEN =
  /from\s+['"]@cosimosi\/(auth|client-cache|api-client|state-machine|config|i18n)['"]/

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full)
  }
  return files
}

describe('design-system isolation', () => {
  it('imports no domain, cache, transport, or product-copy package', () => {
    const offenders = walk(SRC)
      .filter((file) => FORBIDDEN.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file))
    expect(offenders).toEqual([])
  })
})
