import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Pressable, Text } from 'react-native'

import { Menu } from './menu.native.tsx'
import { ObscuredText } from './obscured-text.native.tsx'

vi.mock('react-native', async () => {
  const { createElement } = await import('react')

  interface NativeProps {
    accessibilityLabel?: string
    accessibilityRole?: string
    accessibilityState?: { disabled?: boolean; expanded?: boolean }
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
    Modal: ({ visible, children }: NativeProps) =>
      visible ? createElement('div', { 'data-native-modal': true }, contents(children)) : null,
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      disabled,
      onPress,
      style,
    }: NativeProps) =>
      createElement(
        'button',
        {
          'aria-disabled': accessibilityState?.disabled,
          'aria-expanded': accessibilityState?.expanded,
          'aria-label': accessibilityLabel,
          'data-native-role': accessibilityRole,
          'data-native-style': nativeStyle(style),
          disabled,
          onClick: onPress,
          type: 'button',
        },
        contents(children),
      ),
    ScrollView: ({ children }: NativeProps) => createElement('div', null, contents(children)),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: ({ children, style }: NativeProps) =>
      createElement('span', { 'data-native-style': nativeStyle(style) }, contents(children)),
  }
})

afterEach(cleanup)

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
