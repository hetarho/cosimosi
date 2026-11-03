// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createEmotion } from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'

// The renderer cannot run here; the canvas stub reports the one thing the activity decides.
vi.mock('@cosimosi/3d-renderer', () => ({
  DEFAULT_STAR_SHAPE: 'star',
  InstancedNodeLayer: () => null,
  PostFX: () => null,
  STAR_INSTANCE_BRIGHTNESS: 'brightness',
  STAR_INSTANCE_SCALE: 'scale',
  STAR_INSTANCE_SEED: 'seed',
  STAR_INSTANCE_TINT: 'tint',
  SkinProvider: ({ children }: { children: ReactNode }) => children,
  SpinGroup: ({ children }: { children: ReactNode }) => children,
  UniverseCanvas: ({ active }: { active?: boolean }) => (
    <div data-testid="preview-canvas" data-active={String(active ?? true)} />
  ),
  createStarShapeBodySource: () => ({}),
  resolveActiveSkin: () => 'default',
  useSkin: () => ({ skin: { camera: { fov: 50 }, sky: { night: 0 }, bloom: {} } }),
}))

const { StarPreview, StarPreviewActivity } = await import('./StarPreview.tsx')

const memory = {
  id: 'm1',
  diaryId: 'd1',
  name: 'Market run',
  emotion: createEmotion('JOY'),
  baseStrength: 0.5,
  recallCount: 0,
  createdUniverseTime: '2026-06-20',
  lastRecalledUniverseTime: null,
  seed: 1n,
  activations: [],
  decayStages: [],
  forgettingOffsetDays: 0,
  currentText: 'a memory',
  semanticStage: 0,
} as EpisodicMemory

afterEach(() => cleanup())

describe('StarPreviewActivity', () => {
  const canvas = () => screen.getByTestId('preview-canvas').getAttribute('data-active')

  it('renders by default and parks every preview beneath an inactive activity', () => {
    const view = render(<StarPreview memory={memory} universeTime="2026-06-25" />)
    expect(canvas()).toBe('true')

    view.rerender(
      <StarPreviewActivity active={false}>
        <StarPreview memory={memory} universeTime="2026-06-25" />
      </StarPreviewActivity>,
    )
    expect(canvas()).toBe('false')
  })
})
