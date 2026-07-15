import { useCallback, useEffect, useMemo } from 'react'
import type { ActorRefFrom } from 'xstate'

import { Button } from '@cosimosi/ui'
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
import { GistViewSheet } from './GistViewSheet.tsx'

type NavigationActorRef = ActorRefFrom<typeof universeNavigationMachine>

// widgets/star-detail ([D1]): the read-only side-sheet that opens over the running canvas when a
// node is selected — it never remounts the renderer (A1) and imports no three/visual entity (§3.4).
// It reads the selected id from the canvas navigation machine (the single selection owner, §3.2)
// and owns only its own view phase (starDetailMachine). It composes the three read features + the
// three hand-off buttons; it performs no recall, spend, or navigation itself (A5/A6/A8).
export function DetailPanel({
  navigationActorRef,
  onRecallRequested,
  onOpenDiary,
}: {
  navigationActorRef: NavigationActorRef
  /** Episodic-only: opens the recall flow for this memory (owned downstream); no recall here. */
  onRecallRequested: (episodicMemoryId: string) => void
  /** Emits the origin-diary navigation intent for this memory (the reader is owned downstream). */
  onOpenDiary: (episodicMemoryId: string) => void
}) {
  const selectedNodeId = useSelector(
    navigationActorRef,
    (snapshot) => snapshot.context.selectedNodeId,
  )
  const episodicById = useEpisodicMemoryStore((state) => state.byId)
  const neuronById = useNeuronStore((state) => state.byId)
  const universeTime = useUniverseClockStore((state) => state.currentUniverseTime)

  const selection = useMemo(
    () =>
      resolveSelection(selectedNodeId, { episodicById, neuronById, resolveGist: parseGistNodeId }),
    [selectedNodeId, episodicById, neuronById],
  )
  const [snapshot, send] = useMachine(starDetailMachine)
  const phase = snapshot.value as StarDetailPhase

  const kind = selection.kind
  // Drive the panel phase off the selection identity: a gist body shows the paid gist-view
  // sheet (below) rather than this meta panel, so the meta phase closes; an episodic/neuron
  // selection opens (re-entering meta so a re-select drops a stale provenance view), and
  // no/empty selection closes. Keyed on the id + kind so a store refresh does not reset it.
  useEffect(() => {
    if (kind === 'gist') {
      send({ type: 'CLOSE' })
    } else if (kind === 'episodic' || kind === 'neuron') {
      send({ type: 'OPEN' })
    } else {
      send({ type: 'CLOSE' })
    }
  }, [selectedNodeId, kind, send])

  const clearSelection = useCallback(
    () => navigationActorRef.send({ type: 'CLEAR_SELECTION' }),
    [navigationActorRef],
  )

  const episodicId = selection.kind === 'episodic' ? selection.memory.id : null
  const provenance = useProvenanceQuery(episodicId, phase === 'provenance')

  // A gist body opens the priced gist-view over the canvas (A5); closing clears the canvas
  // selection so re-selecting the same body reopens it.
  if (selection.kind === 'gist') {
    return (
      <GistViewSheet
        episodicMemoryId={selection.episodicMemoryId}
        stage={selection.stage}
        onClose={clearSelection}
      />
    )
  }

  if (phase === 'closed' || selection.kind === 'none') return null

  return (
    <aside
      className="pointer-events-auto absolute top-0 right-0 flex h-full max-w-[90vw] flex-col gap-4 overflow-y-auto border-l border-border bg-surface/95 p-6 backdrop-blur"
      style={{ width: `${STAR_DETAIL_PANEL.widthRem}rem` }}
      aria-label={m.star_detail_title()}
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-base font-medium text-text">
          {selection.kind === 'episodic' ? selection.memory.name : m.star_detail_title_neuron()}
        </h2>
        <Button color="neutral" size="sm" onClick={clearSelection}>
          {m.common_dismiss()}
        </Button>
      </header>

      {phase === 'meta' && (
        <div className="flex flex-col gap-5">
          <MetaBlock selection={selection} universeTime={universeTime} />
          {selection.kind === 'episodic' && (
            <>
              <CurrentMemoryText text={currentDecayText(selection.memory, universeTime)} />
              <div className="flex flex-wrap gap-2">
                <Button
                  color="primary"
                  size="sm"
                  onClick={() => onRecallRequested(selection.memory.id)}
                >
                  {m.star_detail_recall()}
                </Button>
                <Button color="neutral" size="sm" onClick={() => send({ type: 'SHOW_PROVENANCE' })}>
                  {m.star_detail_provenance()}
                </Button>
                <Button color="neutral" size="sm" onClick={() => onOpenDiary(selection.memory.id)}>
                  {m.star_detail_open_diary()}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {phase === 'provenance' && (
        <div className="flex flex-col gap-4">
          <Button color="neutral" size="sm" onClick={() => send({ type: 'BACK' })}>
            {m.star_detail_back()}
          </Button>
          <ProvenanceList entries={provenance.data ?? []} isLoading={provenance.isLoading} />
        </div>
      )}
    </aside>
  )
}
