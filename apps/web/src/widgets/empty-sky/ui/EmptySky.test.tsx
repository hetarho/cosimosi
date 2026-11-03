// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

// The renderer cannot run in jsdom; the stub reports only whether the sky's loop is asked to run.
vi.mock('@cosimosi/3d-renderer', () => ({
  SkySphere: () => null,
  SkinProvider: ({ children }: { children: ReactNode }) => children,
  UniverseCanvas: ({ active }: { active?: boolean }) => (
    <div data-testid="empty-sky-canvas" data-active={String(active ?? true)} />
  ),
  resolveActiveSkin: () => 'default',
  useSkin: () => ({ skin: { camera: { fov: 50 }, sky: { night: 0 } } }),
}))

vi.mock('@cosimosi/universe-render', () => ({ LatentStarField: () => null }))

vi.mock('@cosimosi/observability/react', () => ({
  ObservedErrorBoundary: ({ children }: { children: ReactNode }) => children,
}))

const { EmptySky } = await import('./EmptySky.tsx')

let visibility: DocumentVisibilityState = 'visible'

beforeEach(() => {
  visibility = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function setVisibility(next: DocumentVisibilityState) {
  act(() => {
    visibility = next
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

describe('EmptySky', () => {
  it('parks the sky while the document is hidden and resumes when it returns', () => {
    render(<EmptySky />)
    const canvas = () => screen.getByTestId('empty-sky-canvas').getAttribute('data-active')
    expect(canvas()).toBe('true')

    setVisibility('hidden')
    expect(canvas()).toBe('false')

    setVisibility('visible')
    expect(canvas()).toBe('true')
  })
})
