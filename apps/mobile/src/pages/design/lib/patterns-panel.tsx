import { StyleSheet, Text, View } from 'react-native'

import { moodColor, type Mood } from '@cosimosi/emotion'
import { Badge, Button, Card, Skeleton, TextArea, tokens } from '@cosimosi/ui'

import { MoodChip } from '../../../entities/episodic-memory/index.ts'
import { ProposedMemoryList, type ProposedMemoryView } from '../../../features/split-diary/index.ts'
import { T } from './showcase-copy.ts'
import { Section, Specimen, Stage } from './showcase-shell.tsx'

/**
 * The chrome the primitives compose into, on native.
 *
 * The writing pattern renders the product's OWN proposal list, not a lookalike: a review that reads
 * a mock is reviewing chrome no user sees. Everything else is a static composition of the same
 * primitives the product uses — deliberately unwired, so this screen opens without a session and
 * reproduces exactly.
 *
 * The 3D universe is not reproduced here; the rendered bodies and the sky are reviewed on the /test
 * surface against the real renderer.
 */

const PROPOSED: readonly ProposedMemoryView[] = [
  {
    id: 'p-rain',
    name: 'The rain stopping',
    mood: 'CALM',
    sourceText:
      'The rain stopped sometime in the afternoon and I did not notice until the light changed.',
    neurons: [{ name: 'rain' }, { name: 'afternoon' }],
  },
  {
    id: 'p-page',
    name: 'The same page, four times',
    mood: 'TIRED',
    sourceText: 'I read the same page four times and kept none of it.',
    neurons: [{ name: 'book' }],
  },
]

const LIST_ROWS: readonly { id: string; name: string; mood: Mood; day: string; excerpt: string }[] =
  [
    {
      id: 'm-winter-sea',
      name: 'Winter sea',
      mood: 'CALM',
      day: 'Y1 · D18',
      excerpt: 'The water was the colour of old coins. We did not say much on the way back.',
    },
    {
      id: 'm-laughing-rain',
      name: 'Laughing in the rain',
      mood: 'JOY',
      day: 'Y1 · D21',
      excerpt: 'We ran for the awning and missed it entirely — soaked, laughing at nothing.',
    },
  ]

export function PatternsPanel() {
  return (
    <Section title={T.patternsTitle}>
      <Specimen label={T.writingLabel}>
        <Stage>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{T.writingHeading}</Text>
            <Badge variant="neutral">{T.writingDate}</Badge>
          </View>
          <TextArea label={T.writingBodyLabel} value={T.writingBody} editable={false} />
          <View style={styles.actionRow}>
            <Button color="primary">{T.writingSplit}</Button>
          </View>
          <View style={styles.proposed}>
            <Text style={styles.eyebrow}>{T.writingProposed}</Text>
            <ProposedMemoryList memories={PROPOSED} />
            <View style={styles.footer}>
              <Button variant="text" color="neutral">
                {T.writingBack}
              </Button>
              <Button color="primary">{T.writingLaunch}</Button>
            </View>
          </View>
        </Stage>
      </Specimen>

      <Specimen label={T.detailLabel}>
        <Card variant="glass" style={styles.detail}>
          <View style={styles.detailHeader}>
            <View style={styles.detailIdentity}>
              <View style={styles.chipRow}>
                <MoodChip mood="CALM" />
                <Badge variant="neutral">{T.detailDay}</Badge>
              </View>
              <Text style={styles.detailName}>{T.detailName}</Text>
            </View>
            <View style={[styles.starPreview, { backgroundColor: moodColor('CALM') }]} />
          </View>
          <Text style={styles.body}>{T.detailBody}</Text>
          <View style={styles.detailMeta}>
            <StrengthMeter value={0.82} />
            <Text style={styles.subtle}>{T.detailRecalled}</Text>
          </View>
          <View style={styles.chipRow}>
            <Button size="sm">{T.detailRecall}</Button>
            <Button size="sm" variant="outlined" color="neutral">
              {T.detailHistory}
            </Button>
            <Button size="sm" variant="text" color="neutral">
              {T.detailSource}
            </Button>
          </View>
        </Card>
      </Specimen>

      <Specimen label={T.hudLabel}>
        <View style={styles.hud}>
          <View style={styles.hudTop}>
            <Badge variant="neutral">{T.hudTime}</Badge>
            <Badge variant="neutral">{T.hudBalance}</Badge>
          </View>
          <View style={styles.actionRow}>
            <Button color="primary">{T.hudWrite}</Button>
          </View>
        </View>
      </Specimen>

      <Specimen label={T.listLabel}>
        <Stage>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{T.listHeading}</Text>
            <Text style={styles.subtle}>
              {LIST_ROWS.length} {T.listMemories}
            </Text>
          </View>
          {LIST_ROWS.map((row) => (
            <View key={row.id} style={styles.listRow}>
              <View style={styles.chipRow}>
                <MoodChip mood={row.mood} />
                <Badge variant="neutral">{row.day}</Badge>
              </View>
              <Text style={styles.listName}>{row.name}</Text>
              <Text style={styles.body} numberOfLines={2}>
                {row.excerpt}
              </Text>
            </View>
          ))}
        </Stage>
      </Specimen>

      <Specimen label={T.statesLabel}>
        <Card style={styles.stateCard}>
          <Text style={styles.eyebrow}>{T.stateEmpty}</Text>
          <Text style={styles.stateHeading}>{T.emptyHeading}</Text>
          <Text style={styles.body}>{T.emptyBody}</Text>
          <Button size="sm">{T.emptyAction}</Button>
        </Card>
        <Card style={styles.stateCard}>
          <Text style={styles.eyebrow}>{T.stateLoading}</Text>
          <Text style={styles.stateHeading}>{T.loadingHeading}</Text>
          <Skeleton width="100%" height={14} />
          <Skeleton width="80%" height={14} />
          <Skeleton width="60%" height={14} />
        </Card>
        <Card style={styles.stateCard}>
          <Text style={styles.eyebrow}>{T.stateError}</Text>
          <Badge variant="danger">{T.stateError}</Badge>
          <Text style={styles.stateHeading}>{T.errorHeading}</Text>
          <Text style={styles.body}>{T.errorBody}</Text>
          <Button size="sm" variant="outlined" color="neutral">
            {T.errorAction}
          </Button>
        </Card>
      </Specimen>
    </Section>
  )
}

function StrengthMeter({ value }: { value: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <View style={styles.meterRow}>
      <Text style={styles.subtle}>{T.detailStrength}</Text>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        style={styles.meterTrack}
      >
        <View style={[styles.meterFill, { width: `${percent}%` }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[2],
  },
  sheetTitle: { color: tokens.color.text, fontSize: tokens.fontSize.xl, fontWeight: '600' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  proposed: {
    gap: tokens.spacing[3],
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
    paddingTop: tokens.spacing[4],
  },
  eyebrow: {
    color: tokens.color['text-subtle'],
    fontSize: tokens.fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacing[3],
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
    paddingTop: tokens.spacing[4],
  },
  detail: { gap: tokens.spacing[3] },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: tokens.spacing[3] },
  detailIdentity: { flexShrink: 1, gap: tokens.spacing[2] },
  detailName: { color: tokens.color.text, fontSize: tokens.fontSize.lg, fontWeight: '600' },
  detailMeta: {
    gap: tokens.spacing[2],
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
    paddingTop: tokens.spacing[3],
  },
  starPreview: { width: 48, height: 48, borderRadius: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spacing[2] },
  body: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm, lineHeight: 24 },
  subtle: { color: tokens.color['text-subtle'], fontSize: tokens.fontSize.xs },
  hud: {
    backgroundColor: tokens.color.bg,
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: tokens.spacing[4],
    gap: tokens.spacing[6],
  },
  hudTop: { flexDirection: 'row', justifyContent: 'space-between', gap: tokens.spacing[2] },
  listRow: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 12,
    padding: tokens.spacing[3],
    gap: tokens.spacing[2],
  },
  listName: { color: tokens.color.text, fontSize: tokens.fontSize.base, fontWeight: '600' },
  stateCard: { gap: tokens.spacing[2], alignItems: 'flex-start' },
  stateHeading: { color: tokens.color.text, fontSize: tokens.fontSize.base, fontWeight: '600' },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  meterTrack: {
    width: 80,
    height: 6,
    borderRadius: 999,
    backgroundColor: tokens.color.border,
    overflow: 'hidden',
  },
  meterFill: { height: 6, borderRadius: 999, backgroundColor: tokens.color.primary },
})
