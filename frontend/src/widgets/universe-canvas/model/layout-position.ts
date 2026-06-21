import { fibonacciStarPosition } from '@/shared/lib'

/** A star's live (or settled) position by `stars`-array slot. */
export function readBufferPosition(
  buf: Float32Array | null,
  index: number,
  count: number,
  seed: number,
): [number, number, number] {
  if (buf && index >= 0 && index < count && buf.length >= count * 3) {
    return [buf[index * 3], buf[index * 3 + 1], buf[index * 3 + 2]]
  }
  return fibonacciStarPosition(index, count, seed)
}

/** Settled star positions by id, published by the live layout controller. */
export type LayoutMap = Map<string, [number, number, number]>
