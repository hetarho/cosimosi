import { forceSimCoordinateOffset } from './graph.ts'

// Approximation-internal constants of the Barnes-Hut octree, not layout tuning surfaced to
// config: the opening angle (accuracy/speed of the far-cell approximation), the cell-size
// epsilon that avoids a zero-width split, and the distance softening that avoids a singular
// near-field force. They govern how the O(n log n) approximation is computed, not the shape
// of the emergent layout (that is `repulsion`, which does flow through config).
const BARNES_HUT_THETA = 0.72
const MIN_HALF_SIZE = 0.000001
const SOFTENING = 0.5

interface OctreeNode {
  cx: number
  cy: number
  cz: number
  half: number
  mass: number
  massX: number
  massY: number
  massZ: number
  bodyIndex: number | undefined
  children: Array<OctreeNode | undefined> | undefined
}

export function applyBarnesHutRepulsion(
  positions: Float64Array,
  nodeIndices: readonly number[],
  forces: Float64Array,
  coefficient: number,
): void {
  if (nodeIndices.length < 2 || coefficient === 0) return

  const root = buildTree(positions, nodeIndices)
  for (const nodeIndex of nodeIndices) {
    applyRepulsionFromNode(root, positions, forces, nodeIndex, coefficient)
  }
}

function buildTree(positions: Float64Array, nodeIndices: readonly number[]): OctreeNode {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY

  for (const nodeIndex of nodeIndices) {
    const offset = forceSimCoordinateOffset(nodeIndex)
    const x = positions[offset]
    const y = positions[offset + 1]
    const z = positions[offset + 2]
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    minZ = Math.min(minZ, z)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    maxZ = Math.max(maxZ, z)
  }

  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const cz = (minZ + maxZ) / 2
  const half = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1) / 2 + MIN_HALF_SIZE
  const root = createNode(cx, cy, cz, half)

  for (const nodeIndex of nodeIndices) insert(root, positions, nodeIndex)
  return root
}

function createNode(cx: number, cy: number, cz: number, half: number): OctreeNode {
  return {
    cx,
    cy,
    cz,
    half,
    mass: 0,
    massX: 0,
    massY: 0,
    massZ: 0,
    bodyIndex: undefined,
    children: undefined,
  }
}

function insert(node: OctreeNode, positions: Float64Array, nodeIndex: number, depth = 0): void {
  const offset = forceSimCoordinateOffset(nodeIndex)
  const x = positions[offset]
  const y = positions[offset + 1]
  const z = positions[offset + 2]
  const previousMass = node.mass

  node.mass += 1
  node.massX = (node.massX * previousMass + x) / node.mass
  node.massY = (node.massY * previousMass + y) / node.mass
  node.massZ = (node.massZ * previousMass + z) / node.mass

  if (!node.children && node.bodyIndex === undefined) {
    node.bodyIndex = nodeIndex
    return
  }

  if (node.half <= MIN_HALF_SIZE || depth > 32) {
    node.bodyIndex = undefined
    return
  }

  if (!node.children) {
    const existing = node.bodyIndex
    node.bodyIndex = undefined
    node.children = new Array<OctreeNode | undefined>(8)
    if (existing !== undefined) insertIntoChild(node, positions, existing, depth + 1)
  }

  insertIntoChild(node, positions, nodeIndex, depth + 1)
}

function insertIntoChild(
  node: OctreeNode,
  positions: Float64Array,
  nodeIndex: number,
  depth: number,
): void {
  const offset = forceSimCoordinateOffset(nodeIndex)
  const x = positions[offset]
  const y = positions[offset + 1]
  const z = positions[offset + 2]
  const childIndex = (x >= node.cx ? 1 : 0) | (y >= node.cy ? 2 : 0) | (z >= node.cz ? 4 : 0)
  const childHalf = node.half / 2
  const child =
    node.children?.[childIndex] ??
    createNode(
      node.cx + (x >= node.cx ? childHalf : -childHalf),
      node.cy + (y >= node.cy ? childHalf : -childHalf),
      node.cz + (z >= node.cz ? childHalf : -childHalf),
      childHalf,
    )

  if (node.children) node.children[childIndex] = child
  insert(child, positions, nodeIndex, depth)
}

function applyRepulsionFromNode(
  node: OctreeNode,
  positions: Float64Array,
  forces: Float64Array,
  targetIndex: number,
  coefficient: number,
): void {
  if (node.mass === 0) return
  if (!node.children && node.bodyIndex === targetIndex) return

  const offset = forceSimCoordinateOffset(targetIndex)
  const dx = positions[offset] - node.massX
  const dy = positions[offset + 1] - node.massY
  const dz = positions[offset + 2] - node.massZ
  const distanceSquared = dx * dx + dy * dy + dz * dz + SOFTENING
  const distance = Math.sqrt(distanceSquared)
  const width = node.half * 2

  if (!node.children || width / distance < BARNES_HUT_THETA) {
    const magnitude = (coefficient * node.mass) / distanceSquared
    forces[offset] += (dx / distance) * magnitude
    forces[offset + 1] += (dy / distance) * magnitude
    forces[offset + 2] += (dz / distance) * magnitude
    return
  }

  for (const child of node.children) {
    if (child) applyRepulsionFromNode(child, positions, forces, targetIndex, coefficient)
  }
}
