import { describe, expect, it, vi } from 'vitest'
import { createAsyncResourceLifetime } from './resource-lifetime.ts'

describe('asynchronous resource lifetime', () => {
  it('releases a late setup once without publishing it', () => {
    const dispose = vi.fn()
    const resource = createAsyncResourceLifetime(dispose)
    resource.release()
    expect(dispose).not.toHaveBeenCalled()
    expect(resource.finish()).toBe(false)
    resource.release()
    resource.finish()
    expect(dispose).toHaveBeenCalledOnce()
  })
  it('keeps a ready resource until the owner releases it', () => {
    const dispose = vi.fn()
    const resource = createAsyncResourceLifetime(dispose)
    expect(resource.finish()).toBe(true)
    expect(dispose).not.toHaveBeenCalled()
    resource.release()
    expect(dispose).toHaveBeenCalledOnce()
  })
})
