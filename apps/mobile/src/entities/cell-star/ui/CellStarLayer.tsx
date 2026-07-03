import { useMemo } from 'react'

import { InstancedNodeLayer, createCellStarBodySource, type CoordinateBufferRef } from '@cosimosi/3d-renderer'

import { useNeuronStore } from '../../neuron/@x/cell-star.ts'
import { cellStarChannels } from '../model/cell-star-channels.ts'

export interface CellStarLayerProps {
  readonly positions: CoordinateBufferRef
  readonly onFocus?: (index: number) => void
  readonly onFly?: (index: number) => void
}

// The instanced R3F binding for the neuron point: it reads the neuron mirror via @x and draws
// a seedless point body at the constant size — no per-instance color/seed channels (a neuron
// has no emotion [I3]). Neurons occupy the first buffer slots, so firstNodeIndex is 0.
export function CellStarLayer({ positions, onFocus, onFly }: CellStarLayerProps) {
  const bodySource = useMemo(() => createCellStarBodySource(), [])
  const ids = useNeuronStore((state) => state.ids)

  return (
    <InstancedNodeLayer
      source={bodySource}
      bodyId="cell-star"
      kind="primitive"
      count={ids.length}
      positions={positions}
      scale={cellStarChannels().size}
      onNodePointerDown={onFocus}
      onNodeDoubleClick={onFly}
    />
  )
}
