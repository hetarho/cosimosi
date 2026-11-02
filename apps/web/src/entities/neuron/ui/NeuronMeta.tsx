import type { Neuron } from '@cosimosi/memory'

import { m, neuronTypeLabel } from '../../../shared/i18n/index.ts'
import { MetaRow } from '../../../shared/ui/MetaRow.tsx'

// entities/neuron ui ([D1][I3]): a neuron (small) star's facts — name, kind and how connected it is.
// Info only, and NO emotion: a neuron is not a felt memory.
export function NeuronMeta({ neuron }: { neuron: Neuron }) {
  return (
    <dl className="flex flex-col gap-2">
      <MetaRow
        label={m.star_meta_neuron_name()}
        value={neuron.name ?? m.star_meta_neuron_unnamed()}
      />
      <MetaRow label={m.star_meta_neuron_type()} value={neuronTypeLabel(neuron.neuronType)} />
      <MetaRow label={m.star_meta_neuron_connectivity()} value={String(neuron.connectivity)} />
    </dl>
  )
}
