// This bridge is injected only into the two local, signed-out review frames.
if (window.parent !== window) {
  let seed = 261103
  Math.random = () => {
    // Pin the host's fixture draw across production and development module initialization.
    // Three's UUID allocation keeps a varying random stream.
    const caller = new Error().stack?.split('\n')[2] ?? ''
    if (/\/demo-route-|\/pages\/demo\/ui\/DemoPage/.test(caller)) return 0.25
    seed = (Math.imul(1664525, seed) + 1013904223) | 0
    return (seed >>> 0) / 4294967296
  }
  const send = (message) =>
    window.parent.postMessage({ channel: 'universe-review', ...message }, location.origin)
  const name = (element) =>
    element.getAttribute('aria-label') || element.textContent.trim().replace(/\s+/g, ' ')
  const controls = () => [...document.querySelectorAll('button, [role="button"]')]
  const visible = (element) =>
    !!element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden'
  let replaying = false
  document.addEventListener(
    'click',
    (event) => {
      if (replaying || !event.isTrusted) return
      const control = event.target.closest('button, [role="button"]')
      if (!control || control.disabled) return
      const label = name(control)
      if (!label) return
      const anchor = control.closest('[data-sequence-anchor]')?.getAttribute('data-sequence-anchor')
      const fallbackLabel =
        anchor === 'decorate-close-action'
          ? control
              .closest('[data-cosimosi-surface]')
              ?.querySelector('button[aria-label]')
              ?.getAttribute('aria-label')
          : undefined
      send({
        anchor,
        fallbackLabel,
        type: 'action',
        label,
        index: controls()
          .filter((item) => visible(item) && name(item) === label)
          .indexOf(control),
      })
    },
    true,
  )
  const queue = []
  let timer = null
  const drain = () => {
    clearTimeout(timer)
    const action = queue[0]
    if (!action) return
    let control = controls().filter((item) => visible(item) && name(item) === action.label)[
      action.index
    ]
    if (!control && action.anchor)
      control = document.querySelector(
        `[data-sequence-anchor="${CSS.escape(action.anchor)}"] button`,
      )
    if (!control && action.fallbackLabel)
      control = controls().find((item) => visible(item) && name(item) === action.fallbackLabel)
    if (control && !control.disabled) {
      replaying = true
      control.click()
      replaying = false
      queue.shift()
      send({ type: 'replayed' })
    } else if (Date.now() - action.at > 15000) {
      queue.shift()
      send({ type: 'missed' })
    }
    if (queue.length) timer = setTimeout(drain, 100)
  }
  window.addEventListener('message', (event) => {
    if (
      event.origin !== location.origin ||
      event.source !== window.parent ||
      event.data?.channel !== 'universe-review' ||
      event.data.type !== 'replay'
    )
      return
    queue.push({ ...event.data, at: Date.now() })
    send({ type: 'waiting' })
    drain()
  })
  window.addEventListener('DOMContentLoaded', () => {
    let last = ''
    const report = () => {
      const text = document.querySelector('[aria-live="polite"]')?.textContent?.trim() || ''
      if (text !== last) {
        last = text
        send({ type: 'step', text })
      }
    }
    new MutationObserver(report).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    })
    report()
  })
}
