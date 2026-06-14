// 3D Barnes-Hut tree (octree) for O(N log N) repulsion approximation (spec 07 §
// 설계 요점, acceptance 1.5). Pure: no three / React / DOM. Bodies are referenced
// by index into a flat positions buffer [x0,y0,z0, x1,y1,z1, …]; every body has
// unit mass.

const EPS = 1e-6
// Stop subdividing below this cell half-width so coincident/near-coincident points
// can't recurse forever; such a cell is treated as one approximate mass.
const MIN_HALF = 1e-4
// Hard subdivision-depth backstop. MIN_HALF normally stops recursion, but if a coordinate
// is non-finite the bounding half can be Infinity (Infinity/2 = Infinity never reaches
// MIN_HALF) → infinite recursion → stack overflow. The sim clamps positions so this should
// never trigger; the cap guarantees the tree build can't crash even if a NaN/Infinity slips
// through. 2^48 dynamic range dwarfs any real layout, so a valid tree is never truncated.
const MAX_DEPTH = 48
// Distance floor for the inverse-square law. Clamping dist² to this (not EPS)
// bounds the force when bodies are ~coincident — without it, dist²→0 makes
// repulsion explode, and a body sharing a sub-MIN_HALF bucket would repel itself
// with a near-infinite kick. At the floor the direction (com−pos) is ~0 anyway, so
// the net force on coincident bodies stays negligible. Below the cluster scale
// (linkDistance≈30), so it never perturbs a normal layout.
const MIN_DIST2 = 1

interface Cell {
  cx: number
  cy: number
  cz: number
  half: number
  mass: number
  // mass-weighted position sums; center of mass = (mx,my,mz)/mass
  mx: number
  my: number
  mz: number
  body: number // single body index if leaf, -1 if internal/empty
  children: Array<Cell | null> | null
}

export interface Octree {
  root: Cell | null
  px: Float32Array
}

// Reused traversal stack — accumulateRepulsion is single-threaded and
// non-reentrant, so hoisting this avoids allocating an array per node per tick.
const scratchStack: Cell[] = []

function makeCell(cx: number, cy: number, cz: number, half: number): Cell {
  return { cx, cy, cz, half, mass: 0, mx: 0, my: 0, mz: 0, body: -1, children: null }
}

/** Build a Barnes-Hut octree over the first `count` bodies in `px`. */
export function buildOctree(px: Float32Array, count: number): Octree {
  if (count === 0) return { root: null, px }

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity
  for (let i = 0; i < count; i++) {
    const x = px[i * 3]
    const y = px[i * 3 + 1]
    const z = px[i * 3 + 2]
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (z < minZ) minZ = z
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
    if (z > maxZ) maxZ = z
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const cz = (minZ + maxZ) / 2
  let half = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2 + EPS
  if (!(half > 0)) half = 1

  const root = makeCell(cx, cy, cz, half)
  for (let i = 0; i < count; i++) insert(root, i, px, 0)
  return { root, px }
}

function insert(cell: Cell, bi: number, px: Float32Array, depth: number): void {
  const x = px[bi * 3]
  const y = px[bi * 3 + 1]
  const z = px[bi * 3 + 2]
  cell.mass += 1
  cell.mx += x
  cell.my += y
  cell.mz += z

  // Below the floor (or at the depth backstop): keep as an approximate bucket — don't
  // subdivide further. The depth cap protects against a non-finite half that MIN_HALF
  // can't catch (Infinity/2 stays Infinity), so a stray NaN/Infinity can't blow the stack.
  if (cell.half < MIN_HALF || depth >= MAX_DEPTH) {
    if (cell.body === -1 && cell.children === null) cell.body = bi
    return
  }

  if (cell.body === -1 && cell.children === null) {
    cell.body = bi // empty leaf → place here
    return
  }
  if (cell.children === null) {
    // leaf with one body → subdivide and push the existing body down
    cell.children = [null, null, null, null, null, null, null, null]
    const existing = cell.body
    cell.body = -1
    insertIntoChild(cell, existing, px, depth)
  }
  insertIntoChild(cell, bi, px, depth)
}

function insertIntoChild(cell: Cell, bi: number, px: Float32Array, depth: number): void {
  const x = px[bi * 3]
  const y = px[bi * 3 + 1]
  const z = px[bi * 3 + 2]
  const oct = (x >= cell.cx ? 1 : 0) | (y >= cell.cy ? 2 : 0) | (z >= cell.cz ? 4 : 0)
  let child = cell.children![oct]
  if (!child) {
    const h = cell.half / 2
    child = makeCell(
      cell.cx + (x >= cell.cx ? h : -h),
      cell.cy + (y >= cell.cy ? h : -h),
      cell.cz + (z >= cell.cz ? h : -h),
      h,
    )
    cell.children![oct] = child
  }
  insert(child, bi, px, depth + 1)
}

/** Accumulate the Barnes-Hut repulsion on body `bi` into `out` (vx/vy/vz deltas).
 *  `strength` is the charge (negative = repulsion). Iterative to avoid deep
 *  recursion on large graphs. */
export function accumulateRepulsion(
  tree: Octree,
  bi: number,
  theta: number,
  strength: number,
  out: { fx: number; fy: number; fz: number },
): void {
  const root = tree.root
  if (!root) return
  const px = tree.px
  const x = px[bi * 3]
  const y = px[bi * 3 + 1]
  const z = px[bi * 3 + 2]
  const theta2 = theta * theta

  scratchStack.length = 0
  scratchStack.push(root)
  while (scratchStack.length > 0) {
    const cell = scratchStack.pop()!
    if (cell.mass === 0) continue
    const comX = cell.mx / cell.mass
    const comY = cell.my / cell.mass
    const comZ = cell.mz / cell.mass
    const dx = comX - x
    const dy = comY - y
    const dz = comZ - z
    let dist2 = dx * dx + dy * dy + dz * dz

    const isLeaf = cell.children === null
    if (isLeaf) {
      if (cell.body === bi && cell.mass === 1) continue // self, nothing else here
      if (dist2 < MIN_DIST2) dist2 = MIN_DIST2
      const w = (strength * cell.mass) / dist2
      out.fx += dx * w
      out.fy += dy * w
      out.fz += dz * w
      continue
    }

    // Internal: if cell is far enough (s/d < θ) treat it as one mass, else recurse.
    const s = cell.half * 2
    if (s * s < theta2 * dist2) {
      if (dist2 < MIN_DIST2) dist2 = MIN_DIST2
      const w = (strength * cell.mass) / dist2
      out.fx += dx * w
      out.fy += dy * w
      out.fz += dz * w
    } else {
      const children = cell.children!
      for (let k = 0; k < 8; k++) {
        const c = children[k]
        if (c) scratchStack.push(c)
      }
    }
  }
}
