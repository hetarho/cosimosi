// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { defaultLocale, m, setActiveLocale } from '../../../shared/i18n/index.ts'
import { MoodColorPicker } from './MoodColorPicker.tsx'

afterEach(() => {
  cleanup()
  setActiveLocale(defaultLocale)
})

describe('MoodColorPicker', () => {
  it.each([359.5, 359.9, 360])('keeps a hue of %s inside the range input maximum', (hue) => {
    render(
      <MoodColorPicker value={{ l: 0.72, c: 0.1, h: hue }} disabled={false} onChange={vi.fn()} />,
    )

    const input = screen.getByLabelText(m.palette_picker_hue()) as HTMLInputElement
    expect(Number(input.value)).toBeLessThanOrEqual(Number(input.max))
    expect(input.value).toBe('359')
  })
})
