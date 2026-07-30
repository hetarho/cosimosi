// The two host-owned string-literal unions `SequenceStep` is generic over. They name **only** the
// demo-local controls in `DemoControlRail` and the outcomes those controls produce, which buys two
// things: a typo in the scenario is a compile error, and a control the demo does not own has no
// member to name — so a step can never point at a product affordance this page never mounted.
export type DemoAnchor =
  | 'diary-card'
  | 'split-action'
  | 'launch-action'
  | 'add-diaries-action'
  | 'time-travel-action'
  | 'recall-action'
  | 'taster-rail'
  | 'signup-action'

export type DemoSignal =
  | 'diary_read'
  | 'split_revealed'
  | 'launched'
  | 'diaries_added'
  | 'time_advanced'
  | 'recalled'
  | 'gist_risen'
  | 'sky_filled'
  | 'ornament_tasted'
