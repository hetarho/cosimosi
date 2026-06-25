import { VALUES } from '@/shared/config'

export const LAYOUT_TICKS_PER_FRAME = 2
export const HOT_TAU_MS = VALUES.excitability.tauHours * 60 * 60 * 1000
export const DAY_MS = 86_400_000

export const REKICK_THRESHOLD = VALUES.layout.rekickThreshold
export const REKICK_ALPHA = VALUES.layout.rekickAlpha

const STAR_SHELL_OUTER = 46
export const OBSERVE_MIN_DIST = STAR_SHELL_OUTER + 12
export const SHIP_BOUNDARY = STAR_SHELL_OUTER * 0.85
export const SHIP_LOOK_AHEAD = 24
export const NEBULA_FRAME_DIST = 110

export const NEBULA_ROTATE_SPEED = VALUES.gesture.farRotateSpeed
export const NEBULA_DAMP = VALUES.gesture.farDamp
export const NEBULA_ZOOM_SPEED = VALUES.gesture.farZoomSpeed

export const BASE_SPEED = 16
export const MAX_BOOST = 2
export const BOOST_RAMP = 1.4
export const ACCEL_K = 2.4
export const DRAG_K = 4
export const SPEED_REF = BASE_SPEED * MAX_BOOST
export const RECOIL = 1.2
export const WALL_REARM = 3
export const HIT_SHAKE = 1

export const RECALL_LIGHT_BACK = VALUES.starLighting.recallLightBackOffset
export const RECALL_LIGHT_UP = VALUES.starLighting.recallLightUpOffset
export const IDLE_AMP = 0.09
export const SPEED_AMP = 0.13
export const IMPULSE_AMP = 0.9
export const IMPULSE_DECAY = 6

export const SHAKE_FREQ_IDLE = 0.32
export const SHAKE_FREQ_MOVE = 1.25
export const SHAKE_FREQ_HIT = 1.6

export const LOOK_BASE_RATE = 1.4
export const LOOK_MAX_BOOST = 2.2
export const LOOK_BOOST_RAMP = 1.2
export const LOOK_ACCEL_K = 5
export const LOOK_DRAG_K = 3
export const FOCUS_K = 4

export const SHEET_BREAKPOINT_PX = 640
export const SHEET_VIEW_SHIFT = 1 / 6
export const SHEET_ZOOM = 0.8
