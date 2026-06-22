import * as THREE from 'three'
import { attribute, float, uniform, vec2, vec3 } from 'three/tsl'

// Three TSL accepts Node-like values across its DSL, but the published TS
// overloads are narrower than the runtime graph API. Keep that mismatch here.
const tslInput = (value: unknown): never => value as never

export function asFloatNode(value: unknown) {
  return float(tslInput(value))
}

export function asVec2Node(value: unknown) {
  return vec2(tslInput(value))
}

export function asVec3Node(value: unknown) {
  return vec3(tslInput(value))
}

export function attributeFloatNode(name: string) {
  return asFloatNode(attribute(name, 'float'))
}

export function attributeVec2Node(name: string) {
  return asVec2Node(attribute(name, 'vec2'))
}

export function attributeVec3Node(name: string) {
  return asVec3Node(attribute(name, 'vec3'))
}

export function uniformColorNode(color: THREE.ColorRepresentation) {
  return asVec3Node(uniform(new THREE.Color(color)))
}
