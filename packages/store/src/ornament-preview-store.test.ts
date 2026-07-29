import { beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_ORNAMENT_IDS } from './ornament.ts'
import { useOrnamentPreviewStore } from './ornament-preview-store.ts'
import { resetStoreUserState } from './index.ts'

const store = () => useOrnamentPreviewStore.getState()

describe('ornament preview store', () => {
  beforeEach(() => {
    resetStoreUserState()
  })

  // Nothing outside an open panel can install a preview: the universe cannot be quietly redecorated
  // by a stray call, and there is no "preview mode" to get stuck in.
  it('is inert while no panel is open', () => {
    store().preview('BACKGROUND', 'background.lightfall')
    expect(store().previewed.BACKGROUND).toBe(DEFAULT_ORNAMENT_IDS.BACKGROUND)
    expect(store().previewActive).toBe(false)
  })

  it('shows a preview while open and puts it back on revert', () => {
    store().adopt([{ kind: 'BACKGROUND', ornamentId: 'background.grainstorm' }])
    store().open()
    store().preview('BACKGROUND', 'background.lightfall')
    expect(store().previewed.BACKGROUND).toBe('background.lightfall')
    // The confirmed state is untouched the whole time — that is what makes a revert exact.
    expect(store().confirmed.BACKGROUND).toBe('background.grainstorm')

    store().revert()
    expect(store().previewActive).toBe(false)
    expect(store().previewed.BACKGROUND).toBe('background.grainstorm')
  })

  // The commit takes the SERVER's selection, never the request: what the universe ends up wearing is
  // what was actually saved.
  it('commits from the response and closes', () => {
    store().open()
    store().preview('STAR_SHADER', 'star_shader.geode')
    store().commit([{ kind: 'STAR_SHADER', ornamentId: 'star_shader.haze' }])
    expect(store().previewActive).toBe(false)
    expect(store().confirmed.STAR_SHADER).toBe('star_shader.haze')
    expect(store().previewed.STAR_SHADER).toBe('star_shader.haze')
  })

  // A read that lands while the user is looking at a preview must not yank the sky out from under
  // them; it updates what a revert will go back to.
  it('lets a boot read update the confirmed state without disturbing a live preview', () => {
    store().open()
    store().preview('BACKGROUND', 'background.lightfall')
    store().adopt([{ kind: 'BACKGROUND', ornamentId: 'background.grainstorm' }])
    expect(store().previewed.BACKGROUND).toBe('background.lightfall')
    expect(store().confirmed.BACKGROUND).toBe('background.grainstorm')
  })

  it('leaves nothing of the previous account behind on a scope change', () => {
    store().adopt([{ kind: 'BACKGROUND', ornamentId: 'background.lightfall' }])
    store().open()
    store().preview('STAR_SHADER', 'star_shader.spire')
    resetStoreUserState()
    expect(store()).toMatchObject({
      previewActive: false,
      previewed: DEFAULT_ORNAMENT_IDS,
      confirmed: DEFAULT_ORNAMENT_IDS,
    })
  })

  // An absent entry reads as that kind's default: absence is the one representation of a default, on
  // this side of the wire too.
  it('resolves an absent or blank entry to the kind default', () => {
    store().adopt([{ kind: 'BACKGROUND', ornamentId: '' }])
    expect(store().confirmed.BACKGROUND).toBe(DEFAULT_ORNAMENT_IDS.BACKGROUND)
    expect(store().confirmed.STAR_SHADER).toBe(DEFAULT_ORNAMENT_IDS.STAR_SHADER)
  })
})
