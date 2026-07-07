import {useCallback, useEffect} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {useTransport} from '@connectrpc/connect-query';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {createGetUniverseQueryKey, createGetUniverseQueryOptions} from '@cosimosi/api-client';
import {Button, Dialog, tokens} from '@cosimosi/ui';
import {
  insertLaunchedMemories,
  isPastDated,
  requestLaunchStars,
  writingFlowMachine,
  type WritingFlowStatus,
} from '@cosimosi/universe';

import {ProposedMemoryList, requestSplitDiary} from '../../../features/split-diary/index.ts';
import {ReviseControls, requestReviseSplit} from '../../../features/revise-split/index.ts';
import {LaunchButton, useLaunchedNeuronsStore} from '../../../features/launch-stars/index.ts';
import {WriteDiaryFields, useDiaryDraftStore} from '../../../features/write-diary/index.ts';
import {m} from '../../../shared/i18n/index.ts';
import {useMachine} from '../../../shared/model/index.ts';
import {useProposalStore} from '../model/proposal-store.ts';

// The diary date defaults to *today in the user's own timezone* ([W5]). `toISOString()` would emit
// the UTC date, which is a day behind for KST users in the local 00:00–09:00 window — build the ISO
// date from local calendar components instead.
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

function errorMessage(kind: string | null): string | null {
  if (kind === 'split') return m.writing_flow_error_split();
  if (kind === 'revise') return m.writing_flow_error_revise();
  if (kind === 'launch') return m.writing_flow_error_launch();
  return null;
}

// widgets/writing-flow (RN fork): the "일기 쓰기" affordance + a Modal that composes the four
// features by machine phase (§3.1/§3.2). Shares model/api with web verbatim; only this host + the
// input primitives fork (§3.5). It mounts over the running universe canvas and imports no `three`
// (§3.4) — the launch's visual consequence is the read model's projection.
export function WritingFlowSheet() {
  const [snapshot, send] = useMachine(writingFlowMachine);
  const status = snapshot.value as WritingFlowStatus;
  const error = errorMessage(snapshot.context.error);

  const transport = useTransport();
  const queryClient = useQueryClient();
  // Only universe time is read, to *predict* a past-dated launch and warn before the button is
  // pressed. This is a pre-launch prediction, not the authority — the server returns the real
  // outcome on `pastDated`. A loading/errored read leaves it null → treated as not-past.
  const universeQuery = useQuery(createGetUniverseQueryOptions(transport));
  const universeTime =
    universeQuery.data && universeQuery.data.universeTime !== '' ? universeQuery.data.universeTime : null;

  const body = useDiaryDraftStore(state => state.body);
  const diaryDate = useDiaryDraftStore(state => state.diaryDate);
  const resetDraft = useDiaryDraftStore(state => state.reset);

  const proposal = useProposalStore(state => state.memories);
  const setFromResponse = useProposalStore(state => state.setFromResponse);
  const rename = useProposalStore(state => state.rename);
  const setMood = useProposalStore(state => state.setMood);
  const merge = useProposalStore(state => state.merge);
  const splitMemory = useProposalStore(state => state.split);
  const resetProposal = useProposalStore(state => state.reset);

  const announce = useLaunchedNeuronsStore(state => state.announce);

  const open = useCallback(() => {
    resetDraft(todayIso());
    resetProposal();
    send({type: 'OPEN'});
  }, [resetDraft, resetProposal, send]);

  const close = useCallback(() => {
    send({type: 'CLOSE'});
    resetProposal();
  }, [resetProposal, send]);

  const runSplit = useCallback(() => {
    send({type: 'SPLIT'});
    requestSplitDiary(transport, {body, diaryDate})
      .then(response => {
        setFromResponse(response);
        send({type: 'SPLIT_OK'});
      })
      .catch(() => send({type: 'SPLIT_ERR', error: 'split'}));
  }, [transport, body, diaryDate, setFromResponse, send]);

  const runRevise = useCallback(
    (instruction: string) => {
      send({type: 'REVISE'});
      requestReviseSplit(transport, {body, diaryDate, previous: proposal, instruction})
        .then(response => {
          setFromResponse(response);
          send({type: 'REVISE_OK'});
        })
        .catch(() => send({type: 'REVISE_ERR', error: 'revise'}));
    },
    [transport, body, diaryDate, proposal, setFromResponse, send],
  );

  const runLaunch = useCallback(() => {
    send({type: 'LAUNCH'});
    const memories = proposal;
    requestLaunchStars(transport, {body, diaryDate, memories})
      .then(response => {
        // The server's monotonic guard is authoritative: a past-dated launch saves the diary
        // but creates no memory, so no star appears ([T1][I10]). Gate the optimistic insert on
        // its `pastDated` flag rather than inferring it from an empty id list.
        if (!response.pastDated) {
          insertLaunchedMemories(memories, response.memoryIds, diaryDate);
          announce(response.newNeuronIds);
        }
        queryClient.invalidateQueries({queryKey: createGetUniverseQueryKey(transport)}).catch(() => undefined);
        send({type: 'LAUNCH_OK'});
      })
      .catch(() => send({type: 'LAUNCH_ERR', error: 'launch'}));
  }, [transport, body, diaryDate, proposal, announce, queryClient, send]);

  const editThen = useCallback(
    (apply: () => void) => {
      apply();
      send({type: 'EDIT'});
    },
    [send],
  );

  useEffect(() => {
    if (status !== 'done') return;
    resetProposal();
    resetDraft(todayIso());
    send({type: 'RESET'});
  }, [status, resetProposal, resetDraft, send]);

  const busy = status === 'splitting' || status === 'revising' || status === 'launching';

  return (
    <>
      <Button color="primary" onPress={open}>
        {m.universe_home_write()}
      </Button>
      <Dialog
        open={status !== 'idle' && status !== 'done'}
        onClose={close}
        title={m.writing_flow_title()}
        closeLabel={m.writing_flow_close()}>
        <ScrollView contentContainerStyle={styles.content}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {status === 'writing' ? (
            <>
              <WriteDiaryFields />
              {body.trim().length === 0 ? <Text style={styles.hint}>{m.writing_flow_empty_body_hint()}</Text> : null}
              <Button color="primary" disabled={body.trim().length === 0} onPress={runSplit}>
                {m.writing_flow_split_action()}
              </Button>
            </>
          ) : null}

          {status === 'splitting' ? <Text style={styles.muted}>{m.writing_flow_splitting()}</Text> : null}

          {status === 'reviewing' ? (
            <>
              <Text style={styles.muted}>{m.writing_flow_review_hint()}</Text>
              <ReviseControls
                memories={proposal}
                busy={busy}
                onRename={(index, name) => editThen(() => rename(index, name))}
                onSetMood={(index, mood) => editThen(() => setMood(index, mood))}
                onMerge={index => editThen(() => merge(index))}
                onSplit={index => editThen(() => splitMemory(index))}
                onRevise={runRevise}
              />
              <View style={styles.footer}>
                <Button color="neutral" disabled={busy} onPress={() => send({type: 'BACK'})}>
                  {m.writing_flow_back_action()}
                </Button>
                <LaunchButton pastDated={isPastDated(diaryDate, universeTime)} busy={busy} onLaunch={runLaunch} />
              </View>
            </>
          ) : null}

          {status === 'revising' ? <Text style={styles.muted}>{m.writing_flow_revising()}</Text> : null}

          {status === 'launching' ? (
            <>
              <ProposedMemoryList memories={proposal} />
              <Text style={styles.muted}>{m.writing_flow_launching()}</Text>
            </>
          ) : null}
        </ScrollView>
      </Dialog>
    </>
  );
}

const styles = StyleSheet.create({
  content: {gap: 16},
  error: {color: tokens.color.danger, fontSize: 13},
  hint: {color: tokens.color['text-subtle'], fontSize: 13},
  muted: {color: tokens.color['text-muted'], fontSize: 13},
  footer: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12},
});
