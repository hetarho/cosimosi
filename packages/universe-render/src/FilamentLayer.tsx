import { useMemo } from 'react'

import {
  FatLineLayer,
  createFilamentBodySource,
  type CoordinateBufferRef,
} from '@cosimosi/3d-renderer'

import { projectFilaments, useSynapseStore } from '@cosimosi/universe'

export interface FilamentLayerProps {
  readonly positions: CoordinateBufferRef
  /** Neuron id → coordinate-buffer slot; the ONLY slots a filament endpoint can name [I4][I6]. */
  readonly neuronIndexById: Readonly<Record<string, number>>
  readonly universeTime: string | null
}

// The instanced R3F binding for the synapse fat-line: it reads the synapse mirror via @x and
// projects each synapse — in one aligned pass — to its endpoint neuron slots plus its
// width/brightness channels. A synapse whose endpoint neuron has no slot is dropped (matching
// the graph builder), so endpoints are always two neurons — never a star↔star line. The
// coordinate buffer is read per frame inside the layer; channels recompute only on read-model
// / universe-time change (§3.3).
export function FilamentLayer({ positions, neuronIndexById, universeTime }: FilamentLayerProps) {
  const bodySource = useMemo(() => createFilamentBodySource(), [])
  const byId = useSynapseStore((state) => state.byId)
  const ids = useSynapseStore((state) => state.ids)

  const projection = useMemo(
    () =>
      projectFilaments(
        ids.map((id) => byId[id]).filter((synapse) => synapse !== undefined),
        neuronIndexById,
        universeTime,
      ),
    [byId, ids, neuronIndexById, universeTime],
  )

  return (
    <FatLineLayer
      source={bodySource}
      bodyId="filament"
      kind="shader"
      endpointPairs={projection.endpointPairs}
      count={projection.count}
      positions={positions}
      widths={projection.widths}
      colors={projection.colors}
    />
  )
}
