/* global afterAll, afterEach, beforeEach, console, require */

/**
 * Lifecycle guards for the host-run mobile suites (setupFilesAfterEnv).
 *
 * 1) Console policy: an unexpected console.error/console.warn fails the test that
 *    produced it. React's `act(...)` and update-outside-act complaints arrive through
 *    console.error, so unowned external-store mutations become failures instead of
 *    green noise. A test that expects console output must own it explicitly with
 *    `jest.spyOn(console, 'error').mockImplementation(...)` — there is no blanket
 *    message allowlist here on purpose.
 *
 * 2) Handle policy: a suite that leaves a long real timer pending (e.g. an uncleared
 *    cache gc timeout) fails its own afterAll instead of surfacing later as Jest's
 *    worker force-exit warning, which does not fail CI. Timers are tracked through
 *    async_hooks because process._getActiveHandles() no longer reports Timeouts on
 *    current Node. Sub-second timers are exempt: React's scheduler parks short
 *    housekeeping timeouts that clear on their own and never hold a worker hostage
 *    past Jest's grace period.
 */

const LONG_TIMER_MS = 1000

const { createHook } = require('node:async_hooks')
const { format } = require('node:util')

const unexpectedConsole = []

for (const level of ['error', 'warn']) {
  const original = console[level].bind(console)
  console[level] = (...args) => {
    unexpectedConsole.push({ level, message: format(...args).slice(0, 2000) })
    original(...args)
  }
}

const longTimers = new Map()

const timerHook = createHook({
  init(asyncId, type, _triggerAsyncId, resource) {
    if (type === 'Timeout' && resource && resource._idleTimeout >= LONG_TIMER_MS) {
      longTimers.set(asyncId, resource)
    }
  },
  destroy(asyncId) {
    longTimers.delete(asyncId)
  },
})
timerHook.enable()

function drainUnexpectedConsole(prefix) {
  if (unexpectedConsole.length === 0) return
  const lines = unexpectedConsole
    .splice(0)
    .map(({ level, message }) => `console.${level}: ${message}`)
  throw new Error(`${prefix}:\n${lines.join('\n')}`)
}

// The check runs at three seams because testing-library's automatic unmount runs AFTER
// this file's afterEach: noise produced during that cleanup surfaces at the NEXT test's
// beforeEach (attributed there, but still failing loudly) or at afterAll for the last test.
beforeEach(() => {
  drainUnexpectedConsole(
    "Console output leaked from the previous test's teardown — own it with jest.spyOn(console, '…') in that test",
  )
})

afterEach(() => {
  drainUnexpectedConsole(
    "Unexpected console output — own it with jest.spyOn(console, '…') if the test expects it",
  )
})

afterAll(() => {
  timerHook.disable()
  drainUnexpectedConsole('Unexpected console output after the last test')
  // async_hooks destroy can lag until GC for already-cleared timers (jest's own per-test
  // timeout timers linger in the map that way), so judge by the live resource state. The
  // one live infra timer is jest-circus's timeout for THIS afterAll hook itself
  // (_makeTimeoutMessage) — circus clears it when the hook returns.
  const pending = [...longTimers.values()].filter(
    (resource) =>
      !resource._destroyed && !String(resource._onTimeout).includes('_makeTimeoutMessage'),
  )
  longTimers.clear()
  if (pending.length === 0) return
  const lines = pending.map(
    (resource) =>
      `Timeout(${resource._idleTimeout}ms): ${String(resource._onTimeout).slice(0, 160).replace(/\s+/g, ' ')}`,
  )
  throw new Error(
    `Leaked long-lived timer(s) after the suite — cancel them at their owner:\n${lines.join('\n')}`,
  )
})
