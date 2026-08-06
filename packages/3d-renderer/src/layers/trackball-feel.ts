import type { TrackballControls } from 'three/addons/controls/TrackballControls.js'

/**
 * The trackball settings both camera layers wear identically — the product navigation rig and the
 * demo/design inspection controls. Their rotate/pan speeds deliberately differ and stay named at
 * each layer; these are one decision rather than three settings: inertial damping is what lets a
 * throw keep gliding instead of latching to a stop, and `dynamicDampingFactor` means nothing
 * without `staticMoving` off.
 */
export function applyTrackballFeel(controls: TrackballControls): void {
  controls.staticMoving = false
  controls.dynamicDampingFactor = 0.15
  controls.zoomSpeed = 1.2
}
