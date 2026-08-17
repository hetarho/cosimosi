import { fireEvent, render } from '@testing-library/react-native'

import { maxChromaInGamut } from '@cosimosi/emotion'
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

  // A stored colour is whatever was saved, not a point on this strip: the strip's ceiling moves with
  // hue and lightness, so an arbitrary chroma lands between two swatches. Exactly one still has to
  // read as current, or opening the editor shows a strip with nothing selected at all.
  it('marks exactly one chroma swatch for any colour the editor can open on', () => {
    const lightness = 0.72
    const hue = 15
    const ceiling = maxChromaInGamut(lightness, hue)

    for (const fraction of [0, 0.07, 0.5, 3 / 14, 0.71, 0.93, 1]) {
      const view = render(
        <MoodColorPicker
          value={{ l: lightness, c: ceiling * fraction, h: hue }}
          disabled={false}
          onChange={() => {}}
        />,
      )
      const selected = Array.from({ length: 8 }, (_, index) =>
        view.getByLabelText(`${m.palette_picker_chroma()} ${Math.round((index / 7) * 100)}%`),
      ).filter((swatch) => swatch.props.accessibilityState.selected === true)

      expect(selected).toHaveLength(1)
      view.unmount()
    }
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
