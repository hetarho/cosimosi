const forbiddenCacheFields = new Set([
  'coordinatesBuffer',
  'derivedBrightness',
  'frameCoordinates',
  'perFrameCoordinates',
  'renderBuffer',
  'renderBuffers',
])

export function assertClientCacheData(value: unknown, path = 'data'): void {
  assertClientCacheDataInner(value, path, new WeakSet<object>())
}

function assertClientCacheDataInner(value: unknown, path: string, seen: WeakSet<object>): void {
  if (value === null || value === undefined) return
  if (value instanceof ArrayBuffer || (ArrayBuffer.isView(value) && !(value instanceof Uint8Array))) {
    throw new Error(`${path} is render-loop buffer data and does not belong in TanStack Query cache`)
  }
  if (value instanceof Uint8Array) return
  if (typeof value !== 'object') return
  if (seen.has(value)) {
    throw new Error(`${path} contains circular cache data and does not belong in TanStack Query cache`)
  }
  seen.add(value)
  try {
    assertClientCacheObject(value, path, seen)
  } finally {
    seen.delete(value)
  }
}

function assertClientCacheObject(value: object, path: string, seen: WeakSet<object>): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertClientCacheDataInner(item, `${path}[${index}]`, seen))
    return
  }
  if (value instanceof Map) {
    let index = 0
    for (const [key, item] of value.entries()) {
      assertClientCacheDataInner(key, `${path}.mapKey[${index}]`, seen)
      assertClientCacheDataInner(item, `${path}.mapValue[${index}]`, seen)
      index += 1
    }
    return
  }
  if (value instanceof Set) {
    let index = 0
    for (const item of value.values()) {
      assertClientCacheDataInner(item, `${path}.setValue[${index}]`, seen)
      index += 1
    }
    return
  }
  for (const [key, item] of Object.entries(value)) {
    if (forbiddenCacheFields.has(key)) {
      throw new Error(`${path}.${key} is render-loop data and does not belong in TanStack Query cache`)
    }
    assertClientCacheDataInner(item, `${path}.${key}`, seen)
  }
}
