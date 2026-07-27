import { cos, float, sin, time, vec3 } from 'three/tsl'

import { asFloatNode, asVec3Node } from '../tsl.ts'

const TAU = Math.PI * 2

function rotateX(vector: unknown, angle: unknown) {
  const value = asVec3Node(vector)
  const theta = asFloatNode(angle)
  const cosine = cos(theta)
  const sine = sin(theta)
  return vec3(
    value.x,
    value.y.mul(cosine).sub(value.z.mul(sine)),
    value.y.mul(sine).add(value.z.mul(cosine)),
  )
}

function rotateY(vector: unknown, angle: unknown) {
  const value = asVec3Node(vector)
  const theta = asFloatNode(angle)
  const cosine = cos(theta)
  const sine = sin(theta)
  return vec3(
    value.x.mul(cosine).add(value.z.mul(sine)),
    value.y,
    value.z.mul(cosine).sub(value.x.mul(sine)),
  )
}

function rotateZ(vector: unknown, angle: unknown) {
  const value = asVec3Node(vector)
  const theta = asFloatNode(angle)
  const cosine = cos(theta)
  const sine = sin(theta)
  return vec3(
    value.x.mul(cosine).sub(value.y.mul(sine)),
    value.x.mul(sine).add(value.y.mul(cosine)),
    value.z,
  )
}

/**
 * Turns a body-space vector around all three axes without moving its instance origin. Each seed
 * produces a stable starting pose and its own angular velocity; disabling motion preserves that
 * pose while removing the time input. `speed` only scales the animated portion, so changing it
 * never changes the seed-derived resting pose.
 */
export function seededTurn(vector: unknown, seedValue: unknown, animate: boolean, speed = 1) {
  const seed = asFloatNode(seedValue)
  const elapsed = animate ? asFloatNode(time).mul(float(speed)) : float(0)
  const x = seed
    .mul(4.7)
    .add(0.6)
    .add(elapsed.mul(seed.mul(0.019).add(0.025)))
  const y = seed.mul(TAU).add(elapsed.mul(seed.mul(0.027).add(0.034)))
  const z = seed
    .mul(3.1)
    .add(0.2)
    .add(elapsed.mul(seed.mul(0.023).add(0.018)))
  return rotateZ(rotateY(rotateX(vector, x), y), z)
}
