import { Badge } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// entities/episodic-memory ui: the neurons a memory is an ensemble of, as a labelled chip group.
// The eyebrow names the group and stays out of the document outline (design-language §3); the
// neurons themselves are neutral chips, because membership is structure and carries no status.
export function NeuronChips({ neurons }: { neurons: readonly { readonly name: string }[] }) {
  if (neurons.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold tracking-wide text-text-subtle uppercase">
        {m.writing_flow_neuron_label()}
      </span>
      {neurons.map((neuron) => (
        <Badge key={neuron.name} variant="neutral">
          {neuron.name}
        </Badge>
      ))}
    </div>
  )
}
