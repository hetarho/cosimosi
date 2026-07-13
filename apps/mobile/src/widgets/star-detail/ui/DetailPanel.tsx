import { useEffect, useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import type { ActorRefFrom } from 'xstate'

import { Button, tokens } from '@cosimosi/ui'
import {
  currentDecayText,
  parseGistNodeId,
  resolveSelection,
  starDetailMachine,
  useEpisodicMemoryStore,
  useNeuronStore,
  useUniverseClockStore,
  type StarDetailPhase,
  type universeNavigationMachine,
} from '@cosimosi/universe'

import { CurrentMemoryText } from '../../../features/current-memory-text/index.ts'
import { MetaBlock } from '../../../features/star-meta/index.ts'
import { ProvenanceList, useProvenanceQuery } from '../../../features/star-provenance/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { useMachine, useSelector } from '../../../shared/model/index.ts'
import { STAR_DETAIL_PANEL } from '../config/panel.ts'

type NavigationActorRef = ActorRefFrom<typeof universeNavigationMachine>

// widgets/star-detail (RN fork, [D1]): the read-only bottom sheet that opens over the running
// canvas when a node is selected — no renderer remount (A1), no three/visual entity (§3.4). Reads
// the selected id from the canvas navigation machine (the single selection owner, §3.2) and owns
// only its own view phase. Composes the three read features + the three hand-off buttons; it
// performs no recall, spend, or navigation itself (A5/A6/A8). Shares model/api with web verbatim.
export function DetailPanel({
  navigationActorRef,
  onRecallRequested,
  onOpenDiary,
  onGistSelected,
}: {
  navigationActorRef: NavigationActorRef
  onRecallRequested: (episodicMemoryId: string) => void
  onOpenDiary: (episodicMemoryId: string) => void
  onGistSelected: (episodicMemoryId: string, stage: number) => void
}) {
  const selectedNodeId = useSelector(
    navigationActorRef,
    (snapshot) => snapshot.context.selectedNodeId,
  )
  const episodicById = useEpisodicMemoryStore((state) => state.byId)
  const neuronById = useNeuronStore((state) => state.byId)
  const universeTime = useUniverseClockStore((state) => state.currentUniverseTime)
  const { height } = useWindowDimensions()

  const selection = useMemo(
    () =>
      resolveSelection(selectedNodeId, { episodicById, neuronById, resolveGist: parseGistNodeId }),
    [selectedNodeId, episodicById, neuronById],
  )
  const [snapshot, send] = useMachine(starDetailMachine)
  const phase = snapshot.value as StarDetailPhase

  const kind = selection.kind
  const gist = selection.kind === 'gist' ? selection : null
  const gistMemoryId = gist?.episodicMemoryId ?? null
  const gistStage = gist?.stage ?? null
  useEffect(() => {
    if (gistMemoryId !== null && gistStage !== null) {
      onGistSelected(gistMemoryId, gistStage)
      send({ type: 'CLOSE' })
    } else if (kind === 'episodic' || kind === 'neuron') {
      send({ type: 'OPEN' })
    } else {
      send({ type: 'CLOSE' })
    }
  }, [selectedNodeId, kind, gistMemoryId, gistStage, send, onGistSelected])

  const episodicId = selection.kind === 'episodic' ? selection.memory.id : null
  const provenance = useProvenanceQuery(episodicId, phase === 'provenance')

  if (phase === 'closed' || selection.kind === 'gist' || selection.kind === 'none') return null

  return (
    <View style={[styles.sheet, { maxHeight: height * STAR_DETAIL_PANEL.maxHeightFraction }]}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {selection.kind === 'episodic' ? selection.memory.name : m.star_detail_title_neuron()}
        </Text>
        <Button
          color="neutral"
          size="sm"
          onPress={() => navigationActorRef.send({ type: 'CLEAR_SELECTION' })}
        >
          {m.common_dismiss()}
        </Button>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {phase === 'meta' && (
          <>
            <MetaBlock selection={selection} universeTime={universeTime} />
            {selection.kind === 'episodic' && (
              <>
                <CurrentMemoryText text={currentDecayText(selection.memory, universeTime)} />
                <View style={styles.actions}>
                  <Button
                    color="primary"
                    size="sm"
                    onPress={() => onRecallRequested(selection.memory.id)}
                  >
                    {m.star_detail_recall()}
                  </Button>
                  <Button
                    color="neutral"
                    size="sm"
                    onPress={() => send({ type: 'SHOW_PROVENANCE' })}
                  >
                    {m.star_detail_provenance()}
                  </Button>
                  <Button
                    color="neutral"
                    size="sm"
                    onPress={() => onOpenDiary(selection.memory.id)}
                  >
                    {m.star_detail_open_diary()}
                  </Button>
                </View>
              </>
            )}
          </>
        )}

        {phase === 'provenance' && (
          <>
            <View style={styles.back}>
              <Button color="neutral" size="sm" onPress={() => send({ type: 'BACK' })}>
                {m.star_detail_back()}
              </Button>
            </View>
            <ProvenanceList entries={provenance.data ?? []} isLoading={provenance.isLoading} />
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.color.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: tokens.color.border,
    paddingHorizontal: tokens.spacing[6],
    paddingTop: tokens.spacing[4],
    paddingBottom: tokens.spacing[8],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[2],
    marginBottom: tokens.spacing[4],
  },
  title: { flex: 1, color: tokens.color.text, fontSize: tokens.fontSize.lg, fontWeight: '500' },
  body: { gap: tokens.spacing[5] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  back: { alignItems: 'flex-start' },
})
