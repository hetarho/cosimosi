import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Alert } from './alert.tsx'
import { Badge } from './badge.tsx'
import { Button } from './button.tsx'
import { Checkbox } from './checkbox.tsx'
import { Dialog } from './dialog.tsx'
import { IconButton } from './icon-button.tsx'
import { SegmentedControl } from './segmented-control.tsx'
import { Skeleton } from './skeleton.tsx'
import { Switch } from './switch.tsx'
import { Tabs } from './tabs.tsx'
import { Select } from './select.tsx'
import { TextField } from './text-field.tsx'
import { Toast } from './toast.tsx'
import { Tooltip } from './tooltip.tsx'
import { VisuallyHidden } from './visually-hidden.tsx'

afterEach(cleanup)
afterEach(() => vi.unstubAllGlobals())

describe('Button', () => {
  it('renders its label and is keyboard-clickable', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })

    await user.tab()
    expect(button).toHaveFocus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('disables interaction and marks busy while loading', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    )
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('honors the disabled state', () => {
    render(<Button disabled>Save</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('stays disabled while loading even when disabled is explicitly false', () => {
    render(
      <Button disabled={false} loading>
        Save
      </Button>,
    )
    expect(screen.getByRole('button')).toBeDisabled()
  })
})

describe('IconButton', () => {
  it('exposes its accessible name', () => {
    render(<IconButton label="Close" icon={<svg />} />)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})

describe('TextField', () => {
  it('associates label, description and error', () => {
    render(<TextField label="Email" description="Work address" error="Required" />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const describedBy = input.getAttribute('aria-describedby') ?? ''
    expect(describedBy.split(' ')).toHaveLength(2)
    expect(screen.getByText('Required')).toBeInTheDocument()
  })
})

describe('Select', () => {
  const items = [
    { value: 'calm', label: 'Calm' },
    { value: 'joy', label: 'Joy' },
  ] as const

  it('associates label, description and error like the other fields', () => {
    render(
      <Select
        items={items}
        value="calm"
        onValueChange={() => {}}
        label="Mood"
        description="How it felt"
        error="Pick one"
      />,
    )
    const select = screen.getByLabelText('Mood')
    expect(select).toHaveAttribute('aria-invalid', 'true')
    // ONE aria-describedby carrying both, in reading order — two attributes would let a reader hear the
    // description and miss why the field is invalid.
    const describedBy = select.getAttribute('aria-describedby') ?? ''
    expect(describedBy.split(' ')).toHaveLength(2)
    expect(screen.getByText('Pick one')).toBeInTheDocument()
  })

  it('is a real select, so the keyboard works without being re-implemented', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(<Select items={items} value="calm" onValueChange={onValueChange} label="Mood" />)
    const select = screen.getByRole('combobox', { name: 'Mood' })

    expect(select.tagName).toBe('SELECT')
    expect(screen.getAllByRole('option')).toHaveLength(items.length)
    await user.selectOptions(select, 'joy')
    expect(onValueChange).toHaveBeenCalledWith('joy')
  })

  it('is named by ariaLabel when it carries no visible label', () => {
    render(<Select items={items} value="calm" onValueChange={() => {}} ariaLabel="Mood" />)
    expect(screen.getByRole('combobox', { name: 'Mood' })).toBeInTheDocument()
  })

  it('blocks interaction when disabled', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Select items={items} value="calm" onValueChange={onValueChange} label="Mood" disabled />,
    )
    const select = screen.getByRole('combobox', { name: 'Mood' })

    expect(select).toBeDisabled()
    await user.click(select)
    expect(onValueChange).not.toHaveBeenCalled()
  })
})

describe('Switch', () => {
  it('toggles aria-checked from the keyboard', async () => {
    const user = userEvent.setup()
    function Controlled() {
      const [on, setOn] = useState(false)
      return <Switch checked={on} onCheckedChange={setOn} label="Wifi" />
    }
    render(<Controlled />)
    const toggle = screen.getByRole('switch', { name: 'Wifi' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await user.tab()
    expect(toggle).toHaveFocus()
    await user.keyboard(' ')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })
})

describe('Tabs', () => {
  it('moves selection and roving focus with arrow keys', async () => {
    const user = userEvent.setup()
    function Controlled() {
      const [value, setValue] = useState('profile')
      return (
        <Tabs
          ariaLabel="Account"
          value={value}
          onValueChange={setValue}
          items={[
            { value: 'profile', label: 'Profile', panelId: 'profile-panel' },
            { value: 'diary', label: 'Diary', panelId: 'diary-panel' },
          ]}
        />
      )
    }
    render(<Controlled />)

    const profile = screen.getByRole('tab', { name: 'Profile' })
    const diary = screen.getByRole('tab', { name: 'Diary' })
    expect(profile).toHaveAttribute('aria-selected', 'true')
    profile.focus()
    await user.keyboard('{ArrowRight}')
    expect(diary).toHaveFocus()
    expect(diary).toHaveAttribute('aria-selected', 'true')
    expect(diary).toHaveAttribute('aria-controls', 'diary-panel')
  })
})

describe('SegmentedControl', () => {
  it('exposes a radiogroup and moves selection with arrow keys', async () => {
    const user = userEvent.setup()
    function Controlled() {
      const [value, setValue] = useState('newest')
      return (
        <SegmentedControl
          ariaLabel="Sort"
          value={value}
          onValueChange={setValue}
          items={[
            { value: 'newest', label: 'Newest' },
            { value: 'oldest', label: 'Oldest' },
          ]}
        />
      )
    }
    render(<Controlled />)

    expect(screen.getByRole('radiogroup', { name: 'Sort' })).toBeInTheDocument()
    const newest = screen.getByRole('radio', { name: 'Newest' })
    const oldest = screen.getByRole('radio', { name: 'Oldest' })
    expect(newest).toHaveAttribute('aria-checked', 'true')
    expect(oldest).toHaveAttribute('tabindex', '-1')

    newest.focus()
    await user.keyboard('{ArrowRight}')
    expect(oldest).toHaveFocus()
    expect(oldest).toHaveAttribute('aria-checked', 'true')
    // It selects a value rather than swapping a panel, so no segment controls one.
    expect(oldest).not.toHaveAttribute('aria-controls')
  })

  it('wraps around at the ends', async () => {
    const user = userEvent.setup()
    function Controlled() {
      const [value, setValue] = useState('newest')
      return (
        <SegmentedControl
          ariaLabel="Sort"
          value={value}
          onValueChange={setValue}
          items={[
            { value: 'newest', label: 'Newest' },
            { value: 'oldest', label: 'Oldest' },
          ]}
        />
      )
    }
    render(<Controlled />)

    screen.getByRole('radio', { name: 'Newest' }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'Oldest' })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('Checkbox', () => {
  it('reports checked changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Checkbox label="Agree" onCheckedChange={onChange} />)
    await user.click(screen.getByLabelText('Agree'))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('Dialog', () => {
  it('traps focus, closes on Escape, and restores focus', async () => {
    const user = userEvent.setup()
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Confirm" closeLabel="Close">
            <button type="button">Inner</button>
          </Dialog>
        </>
      )
    }
    render(<Host />)
    const opener = screen.getByRole('button', { name: 'Open' })
    await user.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Confirm' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    // Focus moved into the dialog.
    expect(dialog.contains(document.activeElement)).toBe(true)

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // Focus returned to the trigger.
    expect(opener).toHaveFocus()
  })

  // The sheet's swipe, which is the way out a thumb reaches for before it finds the ✕. jsdom has
  // neither a PointerEvent constructor nor a media query that evaluates, and the gesture needs both:
  // it reads clientY off the pointer and asks whether this screen is the shape with a bottom edge to
  // leave through.
  class TestPointerEvent extends MouseEvent {
    readonly isPrimary: boolean
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.isPrimary = init.isPrimary ?? true
    }
  }

  function stubViewport(sheet: boolean) {
    vi.stubGlobal('PointerEvent', TestPointerEvent)
    vi.stubGlobal('matchMedia', (media: string) => ({ matches: sheet, media }))
  }

  /** Drag the grab surface (the title band) down by `travel` and let go. */
  function swipeDown(travel: number) {
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'Confirm' }), { clientY: 100 })
    fireEvent.pointerMove(window, { clientY: 100 + travel })
    fireEvent.pointerUp(window, { clientY: 100 + travel })
  }

  function renderSheet(onClose: () => void) {
    render(
      <Dialog open onClose={onClose} title="Confirm" closeLabel="Close">
        <button type="button">Inner</button>
      </Dialog>,
    )
  }

  it('closes when a bottom sheet is swiped down', () => {
    stubViewport(true)
    const onClose = vi.fn()
    renderSheet(onClose)

    swipeDown(160)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('springs back instead of closing when the drag is only a nudge', () => {
    stubViewport(true)
    const onClose = vi.fn()
    renderSheet(onClose)

    swipeDown(12)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Confirm' })).toBeInTheDocument()
  })

  it('ignores the swipe on a wide screen, where a centred modal has no edge to leave by', () => {
    stubViewport(false)
    const onClose = vi.fn()
    renderSheet(onClose)

    swipeDown(160)
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('Toast', () => {
  it('uses an assertive alert for danger and auto-dismisses', () => {
    vi.useFakeTimers()
    try {
      const onOpenChange = vi.fn()
      render(
        <Toast open variant="danger" durationMs={3000} onOpenChange={onOpenChange}>
          Saved
        </Toast>,
      )
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive')
      vi.advanceTimersByTime(3000)
      expect(onOpenChange).toHaveBeenCalledWith(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Alert', () => {
  // The distinction the primitive exists to keep: a failure interrupts, a consequence being offered
  // is announced politely. A screen that picks the wrong one either shouts or goes unheard.
  it('interrupts for a failure and stays polite for an offered consequence', () => {
    const { rerender } = render(<Alert variant="danger">It did not go through</Alert>)
    expect(screen.getByRole('alert')).toHaveTextContent('It did not go through')

    rerender(
      <Alert variant="warning" live="status">
        Kept as a diary
      </Alert>,
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Kept as a diary')
  })
})

describe('accessible-name fallbacks', () => {
  it('names a labelless Switch via ariaLabel', () => {
    render(<Switch ariaLabel="Wifi" />)
    expect(screen.getByRole('switch', { name: 'Wifi' })).toBeInTheDocument()
  })

  it('names a titleless Dialog via ariaLabel', () => {
    render(
      <Dialog open ariaLabel="Settings" onClose={() => {}} closeLabel="Close">
        <span>body</span>
      </Dialog>,
    )
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
  })
})

describe('Tooltip', () => {
  it('describes the focusable trigger when shown', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="More info">
        <button type="button">Help</button>
      </Tooltip>,
    )
    const trigger = screen.getByRole('button', { name: 'Help' })
    expect(trigger).not.toHaveAttribute('aria-describedby')
    await user.tab()
    expect(trigger).toHaveFocus()
    const tip = screen.getByRole('tooltip')
    expect(trigger).toHaveAttribute('aria-describedby', tip.id)
    expect(tip).toHaveTextContent('More info')
  })
})

describe('presentational primitives', () => {
  it('VisuallyHidden keeps content in the a11y tree', () => {
    render(<VisuallyHidden>Status</VisuallyHidden>)
    expect(screen.getByText('Status')).toHaveClass('cosimosi-sr-only')
  })

  it('Badge and Skeleton render', () => {
    render(
      <>
        <Badge variant="success">New</Badge>
        <Skeleton width={120} height={16} />
      </>,
    )
    expect(screen.getByText('New')).toBeInTheDocument()
  })
})
