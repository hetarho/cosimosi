// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { awaitDeparture } from './measure-arrival.ts'

describe('surface departure', () => {
  it('waits for removal rather than an animation that has not started yet', async () => {
    const panel = document.createElement('div')
    document.body.append(panel)
    let finished = false
    const departure = awaitDeparture(panel).then(() => {
      finished = true
    })
    panel.append(document.createElement('button'))
    await Promise.resolve()
    expect(finished).toBe(false)
    panel.remove()
    await departure
    expect(finished).toBe(true)
  })
  it('does not wait on a panel that has already gone', async () => {
    await awaitDeparture(document.createElement('div'))
  })
})
