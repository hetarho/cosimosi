import { afterEach, expect, it } from 'vitest'

import { applyProfileLocale } from './locale-bootstrap.ts'
import { getActiveLocale, setActiveLocale } from './locale.ts'

afterEach(() => {
  setActiveLocale('en')
})

it('applies only a supported profile locale', () => {
  applyProfileLocale('ko')
  expect(getActiveLocale()).toBe('ko')

  applyProfileLocale('fr')
  expect(getActiveLocale()).toBe('ko')
})
