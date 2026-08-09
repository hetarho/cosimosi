import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { ActorRefFrom } from 'xstate'

import { Button, Dialog } from '@cosimosi/ui'
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
import { GistViewSheet } from './GistViewSheet.tsx'

type NavigationActorRef = ActorRefFrom<typeof universeNavigationMachine>

/** What the panel shows for one selection: its own accessible name and its body. */
interface DetailView {
  readonly title: string
  readonly body: ReactNode
}

// widgets/star-detail ([D1]): the read-only surface that opens over the running canvas when a node
// is selected — it never remounts the renderer (A1) and imports no three/visual entity (§3.4).
// It reads the selected id from the canvas navigation machine (the single selection owner, §3.2)
// and owns only its own view phase (starDetailMachine). It composes the three read features + the
// three hand-off buttons; it performs no recall, spend, or navigation itself (A5/A6/A8). The host is
// the shared `Dialog`, which is a centred modal on a wide screen and a bottom sheet on a narrow one.
export function DetailPanel({
  navigationActorRef,
  onRecallRequested,
  onOpenDiary,
  onDeleteSourceDiary,
  onLetGo,
}: {
  navigationActorRef: NavigationActorRef
  /** Episodic-only: opens the recall flow for this memory (owned downstream); no recall here. */
  onRecallRequested: (episodicMemoryId: string) => void
  /** Emits the origin-diary navigation intent for this memory (the reader is owned downstream). */
  onOpenDiary: (episodicMemoryId: string) => void
  /** Emits the full-delete intent for this star's source diary — the deletion flow (owned
   *  downstream) affects ALL stars born from that diary, not only the selected one. */
  onDeleteSourceDiary: (episodicMemoryId: string) => void
  /** Emits the letting-go intent for this memory (the deletion flow is owned downstream). */
  onLetGo: (episodicMemoryId: string) => void
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

  // Held one animation past the close, because the host stays on screen for the length of its exit.
  // What is held is the VIEW ITSELF, not the selection it was built from: the selection is already
  // gone by then, and re-deriving a body from a cleared one would empty the panel mid-slide.
  // Re-rendering the same elements keeps their own state and issues no new read. This lives ABOVE
  // the gist branch below, because a hook cannot sit behind an early return.
  const open = phase !== 'closed' && selection.kind !== 'none'
  const heldView = useRef<DetailView | null>(null)

  // A gist body opens the priced gist-view over the canvas (A5); closing clears the canvas
  // selection so re-selecting the same body reopens it.
  if (selection.kind === 'gist') {
    return <GistViewSheet episodicMemoryId={selection.episodicMemoryId} onClose={clearSelection} />
  }

  const view: DetailView | null = open
    ? {
        // The star's own name is the surface's name — a heading that says which star this is beats a
        // generic one the user has to look past.
        title: selection.kind === 'episodic' ? selection.memory.name : m.star_detail_title_neuron(),
        body: (
          <>
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
                      <Button
                        color="neutral"
                        size="sm"
                        onClick={() => send({ type: 'SHOW_PROVENANCE' })}
                      >
                        {m.star_detail_provenance()}
                      </Button>
                      <Button
                        color="neutral"
                        size="sm"
                        onClick={() => onOpenDiary(selection.memory.id)}
                      >
                        {m.star_detail_open_diary()}
                      </Button>
                      <Button
                        color="neutral"
                        size="sm"
                        onClick={() => onLetGo(selection.memory.id)}
                      >
                        {m.star_detail_letgo()}
                      </Button>
                      <Button
                        color="danger"
                        size="sm"
                        onClick={() => onDeleteSourceDiary(selection.memory.id)}
                      >
                        {m.star_detail_delete_source()}
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
                <ProvenanceList
                  entries={provenance.entries}
                  status={provenance.status}
                  onRetry={provenance.retry}
                />
              </div>
            )}
          </>
        ),
      }
    : null
  if (view) heldView.current = view
  const shown = view ?? heldView.current
  if (!shown) return null

  return (
    <Dialog
      open={open}
      onClose={clearSelection}
      title={shown.title}
      closeLabel={m.common_dismiss()}
    >
      {shown.body}
    </Dialog>
  )
}
