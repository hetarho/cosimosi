import { useState, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Pressable, Text } from 'react-native'

import { Select } from './select.native.tsx'
import { Menu } from './menu.native.tsx'
import { Disclosure } from './disclosure.native.tsx'
import { ObscuredText } from './obscured-text.native.tsx'

vi.mock('react-native', async () => {
  const { createElement } = await import('react')

  interface NativeProps {
    accessibilityLabel?: string
    accessibilityElementsHidden?: boolean
    accessibilityRole?: string
    accessibilityState?: { disabled?: boolean; expanded?: boolean; selected?: boolean }
    accessibilityViewIsModal?: boolean
    children?: ReactNode | ((state: { pressed: boolean }) => ReactNode)
    disabled?: boolean
    onPress?: () => void
    style?: unknown
    visible?: boolean
  }

  const contents = (children: NativeProps['children']) =>
    typeof children === 'function' ? children({ pressed: false }) : children
  const nativeStyle = (style: unknown) => JSON.stringify(style)

  return {
    View: ({ accessibilityElementsHidden, children }: NativeProps) =>
      createElement('div', { hidden: accessibilityElementsHidden }, contents(children)),
    Modal: ({ visible, children }: NativeProps) =>
      visible ? createElement('div', { 'data-native-modal': true }, contents(children)) : null,
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      accessibilityViewIsModal,
      children,
      disabled,
      onPress,
      style,
    }: NativeProps) => {
      // Labeled leaf controls include the no-role Draft in the Disclosure test. Modal panels and
      // backdrops are structural hosts, so their nested controls never become nested DOM buttons.
      const leaf =
        !accessibilityViewIsModal &&
        (accessibilityRole !== undefined || accessibilityLabel !== undefined)
      return createElement(
        leaf ? 'button' : 'div',
        {
          'aria-disabled': accessibilityState?.disabled,
          'aria-expanded': accessibilityState?.expanded,
          'aria-selected': accessibilityState?.selected,
          'aria-label': accessibilityLabel,
          'data-native-role': accessibilityRole,
          'data-native-style': nativeStyle(style),
          'data-native-backdrop': !leaf && !accessibilityViewIsModal ? true : undefined,
          disabled: leaf ? disabled : undefined,
          onClick: (event: { stopPropagation: () => void }) => {
            // RN dispatches to the chosen responder; a leaf press does not also press the backdrop.
            event.stopPropagation()
            if (!disabled) onPress?.()
          },
          type: leaf ? 'button' : undefined,
        },
        contents(children),
      )
    },
    ScrollView: ({ children }: NativeProps) => createElement('div', null, contents(children)),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: ({ children, style }: NativeProps) =>
      createElement('span', { 'data-native-style': nativeStyle(style) }, contents(children)),
  }
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'error')
  vi.spyOn(console, 'warn')
})

afterEach(() => {
  try {
    cleanup()
    expect(document.body.childElementCount).toBe(0)
    expect(document.querySelectorAll('[data-native-modal]')).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  } finally {
    vi.restoreAllMocks()
    vi.useRealTimers()
  }
})

describe('Disclosure (native)', () => {
  it('hides controls from accessibility without losing their edit state', () => {
    function Draft() {
      const [value, setValue] = useState(0)
      return (
        <Pressable
          accessibilityLabel="Change draft"
          onPress={() => setValue((current) => current + 1)}
        >
          <Text>{value}</Text>
        </Pressable>
      )
    }
    render(
      <Disclosure label="Edit memory">
        <Draft />
      </Disclosure>,
    )
    const trigger = screen.getByRole('button', { name: 'Edit memory' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Change draft' })).toBeNull()
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Change draft' }))
    fireEvent.click(trigger)
    expect(screen.queryByRole('button', { name: 'Change draft' })).toBeNull()
    fireEvent.click(trigger)
    expect(screen.getByRole('button', { name: 'Change draft' })).toHaveTextContent('1')
  })
})

describe('Menu (native)', () => {
  it('clones its trigger, exposes the sheet, and closes after an enabled command', () => {
    const onSelect = vi.fn()
    render(
      <Menu
        ariaLabel="Memory actions"
        items={[
          { value: 'keep', label: 'Keep', onSelect },
          { value: 'disabled', label: 'Unavailable', disabled: true, onSelect: vi.fn() },
        ]}
        trigger={
          <Pressable accessibilityRole="button" accessibilityLabel="Open actions">
            <Text>Open</Text>
          </Pressable>
        }
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Open actions' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)

    expect(screen.getByLabelText('Memory actions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByLabelText('Memory actions')).toBeNull()
  })
})

describe('ObscuredText (native)', () => {
  it('leaves readable runs plain and replaces obscured ink with a zero-offset smear', () => {
    render(
      <ObscuredText
        spans={[
          { text: 'still here', obscured: false },
          { text: 'forgotten', obscured: true },
        ]}
      />,
    )

    expect(screen.getByText('still here')).not.toHaveAttribute('data-native-style')
    const obscuredStyle = screen.getByText('forgotten').getAttribute('data-native-style') ?? ''
    expect(obscuredStyle).toContain('transparent')
    expect(obscuredStyle).toContain('textShadowRadius')
    expect(obscuredStyle).toContain('"width":0')
    expect(obscuredStyle).toContain('"height":0')
  })
})

describe('Select (native)', () => {
  const items = [
    { value: 'calm', label: 'Calm' },
    { value: 'joy', label: 'Joy' },
  ]
  function ControlledSelect({
    disabled = false,
    onValueChange = () => {},
  }: {
    disabled?: boolean
    onValueChange?: (value: string) => void
  }) {
    const [value, setValue] = useState('calm')
    return (
      <Select
        ariaLabel="Mood"
        items={items}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          onValueChange(next)
          setValue(next)
        }}
      />
    )
  }
  const trigger = () => screen.getByRole('button', { name: 'Mood' })
  const modal = () => document.querySelector('[data-native-modal]')
  const dismissBackdrop = () => {
    const backdrop = document.querySelector('[data-native-backdrop]')
    if (!backdrop) throw new Error('Expected the open native Select backdrop')
    fireEvent.click(backdrop)
  }

  it('blocks option changes when an open Select becomes disabled', () => {
    const onValueChange = vi.fn()
    const view = render(<ControlledSelect onValueChange={onValueChange} />)
    fireEvent.click(trigger())
    expect(modal()).not.toBeNull()
    view.rerender(<ControlledSelect disabled onValueChange={onValueChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Joy' }))
    expect(onValueChange).not.toHaveBeenCalled()
    expect(trigger()).toHaveTextContent('Calm')
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(modal()).not.toBeNull()
    const options = document.querySelectorAll('[data-native-role="button"][aria-selected]')
    expect(options).toHaveLength(2)
    for (const option of options) {
      expect(option).toBeDisabled()
      expect(option).toHaveAttribute('aria-disabled', 'true')
      expect(option.getAttribute('data-native-style')).toContain('"opacity":0.5')
    }
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveAttribute('aria-selected', 'false')
  })

  it('selects an enabled option once and closes the list', () => {
    const onValueChange = vi.fn()
    render(<ControlledSelect onValueChange={onValueChange} />)
    fireEvent.click(trigger())
    expect(
      [...document.querySelectorAll('[aria-selected]')].map((node) => node.textContent),
    ).toEqual(['Calm✓', 'Joy'])
    fireEvent.click(screen.getByRole('button', { name: 'Joy' }))
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('joy')
    expect(trigger()).toHaveTextContent('Joy')
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(modal()).toBeNull()
  })

  it('does not open an initially disabled Select', () => {
    const onValueChange = vi.fn()
    render(<ControlledSelect disabled onValueChange={onValueChange} />)
    expect(trigger()).toBeDisabled()
    fireEvent.click(trigger())
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(modal()).toBeNull()
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('uses the current callback when an open Select rerenders', () => {
    const original = vi.fn(),
      current = vi.fn()
    const view = render(<ControlledSelect onValueChange={original} />)
    fireEvent.click(trigger())
    view.rerender(<ControlledSelect onValueChange={current} />)
    fireEvent.click(screen.getByRole('button', { name: 'Joy' }))
    expect(original).not.toHaveBeenCalled()
    expect(current).toHaveBeenCalledExactlyOnceWith('joy')
    expect(trigger()).toHaveTextContent('Joy')
    expect(modal()).toBeNull()
  })

  it('allows selection after an open Select is reenabled', () => {
    const onValueChange = vi.fn()
    const view = render(<ControlledSelect onValueChange={onValueChange} />)
    fireEvent.click(trigger())
    view.rerender(<ControlledSelect disabled onValueChange={onValueChange} />)
    expect(modal()).not.toBeNull()
    view.rerender(<ControlledSelect onValueChange={onValueChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Joy' }))
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('joy')
    expect(trigger()).toHaveTextContent('Joy')
    expect(modal()).toBeNull()
  })

  it.each([false, true])(
    'dismisses an open Select through its backdrop with disabled=%s',
    (disabled) => {
      const onValueChange = vi.fn()
      const view = render(<ControlledSelect onValueChange={onValueChange} />)
      fireEvent.click(trigger())
      view.rerender(<ControlledSelect disabled={disabled} onValueChange={onValueChange} />)
      expect(modal()).not.toBeNull()
      dismissBackdrop()
      expect(onValueChange).not.toHaveBeenCalled()
      expect(trigger()).toHaveTextContent('Calm')
      expect(trigger()).toHaveAttribute('aria-expanded', 'false')
      expect(modal()).toBeNull()
    },
  )
})
