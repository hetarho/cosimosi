import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Badge } from './badge.tsx'
import { Button } from './button.tsx'
import { Checkbox } from './checkbox.tsx'
import { Dialog } from './dialog.tsx'
import { IconButton } from './icon-button.tsx'
import { Skeleton } from './skeleton.tsx'
import { Switch } from './switch.tsx'
import { TextField } from './text-field.tsx'
import { Toast } from './toast.tsx'
import { Tooltip } from './tooltip.tsx'
import { VisuallyHidden } from './visually-hidden.tsx'

afterEach(cleanup)

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
