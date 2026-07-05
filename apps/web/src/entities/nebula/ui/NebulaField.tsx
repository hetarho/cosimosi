import { useMemo } from 'react'

import { VALUES } from '@cosimosi/config'
import { ColorField, type CoordinateBufferRef } from '@cosimosi/3d-renderer'

import { useEpisodicMemoryStore } from '../../episodic-memory/@x/nebula.ts'
import { buildContributors } from '../lib/contributors.ts'

export interface NebulaFieldProps {
  readonly positions: CoordinateBufferRef
  /** Memories occupy buffer slots [firstNodeIndex, firstNodeIndex + count) after the neurons. */
  readonly firstNodeIndex: number
  /** Kernel silhouette tessellation; omit for the web default (the mount passes the platform value). */
  readonly resolution?: number
}

// The R3F binding for the emotion color field (visual entity, §3.1/§3.4): it reads the domain
// mirror via @x, packs each memory into a color/radius contributor through the palette seam
// (lib/, recomputed only when the read model changes — never per frame), and feeds the buffer to
// the domain-agnostic ColorField layer. Positions are read per frame inside the layer from the
// coordinate buffer, never here (§3.3). Color comes solely from `moodColor`; the slice computes
// no color of its own and writes nothing back to the mirror [A4][A5][A7].
export function NebulaField({ positions, firstNodeIndex, resolution }: NebulaFieldProps) {
  const byId = useEpisodicMemoryStore((state) => state.byId)
  const ids = useEpisodicMemoryStore((state) => state.ids)
  const contributors = useMemo(
    () => buildContributors(ids.map((id) => byId[id]), { firstNodeIndex }),
    [byId, ids, firstNodeIndex],
  )
  return (
    <ColorField
      positions={positions}
      count={contributors.count}
      nodeIndices={contributors.nodeIndices}
      tints={contributors.tints}
      radii={contributors.radii}
      falloffExponent={VALUES.nebula.falloffExponent}
      baseIntensity={VALUES.nebula.baseIntensity}
      resolution={resolution ?? VALUES.nebula.fieldResolutionWeb}
    />
  )
}
