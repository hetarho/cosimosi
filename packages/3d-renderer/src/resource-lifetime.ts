/** Release once after asynchronous setup settles, including an owner lost during setup. */
export function createAsyncResourceLifetime(dispose: () => void) {
  let settled = false
  let released = false
  let disposed = false
  const flush = () => {
    if (!settled || !released || disposed) return
    disposed = true
    dispose()
  }
  return {
    release() {
      released = true
      flush()
    },
    finish() {
      settled = true
      flush()
      return !released
    },
  }
}
