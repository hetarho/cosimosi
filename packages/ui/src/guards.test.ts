import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

// The design system is domain-agnostic: it may read platform-pure generated tuning from config, but
// it must not reach into product domain, the data cache, the transport client, state machines, or
// the i18n message catalogue — copy arrives through props. Importing any of those would let a
// primitive embed product behavior/strings or touch domain/cache state.
const FORBIDDEN = /from\s+['"]@cosimosi\/(auth|client-cache|api-client|state-machine|i18n)['"]/
const CONFIG_IMPORT = /from\s+['"]@cosimosi\/config['"]/
const CONFIG_EXCEPTION = 'lib/sheet-geometry.ts'

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
  const files = walk(SRC)

  it('never imports domain, cache, transport, state, or product copy', () => {
    const offenders = files
      .filter((file) => FORBIDDEN.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file))
    expect(offenders).toEqual([])
  })

  it('confines generated config to the interaction-geometry seam and its ui group', () => {
    const importers = files
      .filter((file) => CONFIG_IMPORT.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file))
    expect(importers).toEqual([CONFIG_EXCEPTION])

    const seam = readFileSync(join(SRC, CONFIG_EXCEPTION), 'utf8')
    const valueGroups = new Set(
      [...seam.matchAll(/\bVALUES\.([A-Za-z0-9_]+)/g)].map((match) => match[1]),
    )
    expect(valueGroups).toEqual(new Set(['ui']))
  })
})
