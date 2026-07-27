import { StyleSheet, Text, View } from 'react-native'

import { Badge, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// entities/episodic-memory ui (RN fork): the neurons a memory is an ensemble of, as a labelled chip
// group. The eyebrow names the group (design-language §3); the neurons are neutral chips, because
// membership is structure and carries no status.
export function NeuronChips({ neurons }: { neurons: readonly { readonly name: string }[] }) {
  if (neurons.length === 0) return null
  return (
    <View style={styles.row}>
      <Text style={styles.eyebrow}>{m.writing_flow_neuron_label()}</Text>
      {neurons.map((neuron) => (
        <Badge key={neuron.name} variant="neutral">
          {neuron.name}
        </Badge>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spacing[2] },
  eyebrow: {
    color: tokens.color['text-subtle'],
    fontSize: tokens.fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
})
