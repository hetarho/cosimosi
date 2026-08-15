import { fireEvent, render } from '@testing-library/react-native'

import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'

import { m } from '../../../shared/i18n/index.ts'
import { MoodColorPicker } from './MoodColorPicker.tsx'

afterEach(() => setActiveLocale(defaultLocale))

describe('MoodColorPicker (mobile)', () => {
  it('names every hue and chroma swatch by its own value', () => {
    const view = render(
      <MoodColorPicker value={{ l: 0.72, c: 0.1, h: 15 }} disabled={false} onChange={() => {}} />,
    )

    const labels = [
      ...Array.from(
        { length: 24 },
        (_, index) => `${m.palette_picker_hue()} ${Math.round((index * 360) / 24)}°`,
      ),
      ...Array.from(
        { length: 8 },
        (_, index) => `${m.palette_picker_chroma()} ${Math.round((index / 7) * 100)}%`,
      ),
    ]

    for (const label of labels) expect(view.getByLabelText(label)).toBeTruthy()
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('offers an achromatic swatch at the chroma floor', () => {
    const onChange = jest.fn()
    const view = render(
      <MoodColorPicker value={{ l: 0.72, c: 0.1, h: 15 }} disabled={false} onChange={onChange} />,
    )

    fireEvent.press(view.getByLabelText(`${m.palette_picker_chroma()} 0%`))

    expect(onChange).toHaveBeenCalledWith({ l: 0.72, c: 0, h: 15 })
  })
})
