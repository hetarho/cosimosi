import type { DemoDiarySet } from '../diary-set.ts'

import { MOVING_BOXES_SET } from './moving-boxes.ts'
import { ROOFTOP_SUMMER_SET } from './rooftop-summer.ts'
import { WINTER_SEA_SET } from './winter-sea.ts'

// The shipped pool. Its size is this array's length — a count that is the length of a content array
// is not a tuning number, so the demo claims no `values.yaml` key for it. Typed non-empty so
// `pickDemoDiarySet` is total without a runtime emptiness check.
export const DEMO_DIARY_SETS: readonly [DemoDiarySet, ...DemoDiarySet[]] = [
  WINTER_SEA_SET,
  ROOFTOP_SUMMER_SET,
  MOVING_BOXES_SET,
]
