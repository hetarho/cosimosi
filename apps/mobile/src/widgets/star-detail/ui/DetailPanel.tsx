import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import type { ActorRefFrom } from 'xstate'

import { Button, IconButton, Menu, StarActionsIcon, tokens, usePresence } from '@cosimosi/ui'
import { useWornOrnaments } from '@cosimosi/store/react'
import {
  currentDecaySpans,
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

/** Matches the leave timing in `PanelSlide` — the timer, not the animation, is what unmounts. */
const EXIT_MS = 200

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
  onDeleteSourceDiary,
  onLetGo,
}: {
  navigationActorRef: NavigationActorRef
  onRecallRequested: (episodicMemoryId: string) => void
  onOpenDiary: (episodicMemoryId: string) => void
  /** Emits the full-delete intent for this star's source diary — the deletion flow affects ALL
   *  stars born from that diary, not only the selected one. */
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
  // Resolved at the WIDGET, not inside `features/star-meta`: the read features stay provider-free,
  // and the panel's star wears exactly what the sky behind it wears ([P4]).
  const worn = useWornOrnaments()
  const { height } = useWindowDimensions()

  const selection = useMemo(
    () =>
      resolveSelection(selectedNodeId, { episodicById, neuronById, resolveGist: parseGistNodeId }),
    [selectedNodeId, episodicById, neuronById],
  )
  const [snapshot, send] = useMachine(starDetailMachine)
  const phase = snapshot.value as StarDetailPhase

  const kind = selection.kind
  // A gist body shows the paid gist-view sheet (below) rather than this meta panel, so the
  // meta phase closes; an episodic/neuron selection opens, no/empty selection closes.
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

  // Held one animation past the close so the panel can slide back out the edge it came in from. What is
  // held is the CONTENT ITSELF, not the selection it was built from: the selection is already gone by
  // then, and re-deriving a body from a cleared one would empty the panel mid-slide. Re-rendering the
  // same elements keeps their own state and issues no new read. Both live ABOVE the gist branch below,
  // because a hook cannot sit behind an early return.
  const open = phase !== 'closed' && selection.kind !== 'none'
  const { present, phase: motion } = usePresence(open, EXIT_MS)
  const heldContent = useRef<ReactNode>(null)

  // A gist body opens the priced gist-view over the canvas (A5); closing clears the canvas
  // selection so re-selecting the same body reopens it.
  if (selection.kind === 'gist') {
    return <GistViewSheet episodicMemoryId={selection.episodicMemoryId} onClose={clearSelection} />
  }

  const content = open ? (
    <>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {selection.kind === 'episodic' ? selection.memory.name : m.star_detail_title_neuron()}
        </Text>
        <Button color="neutral" size="sm" onPress={clearSelection}>
          {m.common_dismiss()}
        </Button>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {phase === 'meta' && (
          <>
            <MetaBlock
              selection={selection}
              universeTime={universeTime}
              shape={worn.STAR_SHADER}
              previewAction={
                selection.kind === 'episodic' ? (
                  <Menu
                    ariaLabel={m.star_detail_actions_label()}
                    trigger={
                      <IconButton
                        variant="outlined"
                        color="neutral"
                        size="sm"
                        label={m.star_detail_actions_label()}
                        icon={<StarActionsIcon />}
                      />
                    }
                    items={[
                      {
                        value: 'provenance',
                        label: m.star_detail_provenance(),
                        onSelect: () => send({ type: 'SHOW_PROVENANCE' }),
                      },
                      {
                        value: 'diary',
                        label: m.star_detail_open_diary(),
                        onSelect: () => onOpenDiary(selection.memory.id),
                      },
                      {
                        value: 'letgo',
                        label: m.star_detail_letgo(),
                        onSelect: () => onLetGo(selection.memory.id),
                      },
                      {
                        value: 'delete-source',
                        label: m.star_detail_delete_source(),
                        tone: 'danger',
                        onSelect: () => onDeleteSourceDiary(selection.memory.id),
                      },
                    ]}
                  />
                ) : undefined
              }
            />
            {selection.kind === 'episodic' && (
              <>
                <CurrentMemoryText spans={currentDecaySpans(selection.memory, universeTime)} />
                <View style={styles.actions}>
                  <Button
                    color="primary"
                    size="sm"
                    onPress={() => onRecallRequested(selection.memory.id)}
                  >
                    {m.star_detail_recall()}
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
            <ProvenanceList
              entries={provenance.entries}
              status={provenance.status}
              onRetry={provenance.retry}
            />
          </>
        )}
      </ScrollView>
    </>
  ) : null
  if (content) heldContent.current = content
  const shown = content ?? heldContent.current
  if (!present || !shown) return null

  return (
    <PanelSlide
      leaving={motion === 'leaving'}
      style={[styles.sheet, { maxHeight: height * STAR_DETAIL_PANEL.maxHeightFraction }]}
    >
      {shown}
    </PanelSlide>
  )
}

// The slide itself, split out so the panel body above stays a list of features rather than a list of
// features wrapped in animation plumbing. Mirrors the web `.panel-enter` / `.panel-leave` pair, on the
// bottom edge this platform's panel lives on.
function PanelSlide({
  leaving,
  style,
  children,
}: {
  readonly leaving: boolean
  readonly style: StyleProp<ViewStyle>
  readonly children: ReactNode
}) {
  const offset = useRef(new Animated.Value(1)).current
  useEffect(() => {
    let cancelled = false
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (cancelled) return
        if (reduced) {
          offset.setValue(leaving ? 1 : 0)
          return
        }
        Animated.timing(offset, {
          toValue: leaving ? 1 : 0,
          duration: leaving ? EXIT_MS : 240,
          easing: leaving ? Easing.in(Easing.cubic) : Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start()
      })
      .catch(() => offset.setValue(leaving ? 1 : 0))
    return () => {
      cancelled = true
    }
  }, [offset, leaving])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: offset.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [
            { translateY: offset.interpolate({ inputRange: [0, 1], outputRange: [0, 48] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
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
