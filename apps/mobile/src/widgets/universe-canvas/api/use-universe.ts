import {useEffect, useMemo} from 'react';

import {useTransport} from '@connectrpc/connect-query';
import {useQuery} from '@tanstack/react-query';

import {createGetUniverseQueryOptions} from '@cosimosi/api-client';
import {universeFromResponse, type UniverseSnapshot} from '@cosimosi/memory';

import {useEpisodicMemoryStore} from '../../../entities/episodic-memory/index.ts';
import {useNeuronStore} from '../../../entities/neuron/index.ts';
import {useSynapseStore} from '../../../entities/synapse/index.ts';

export interface UniverseReadState {
  universe: UniverseSnapshot | null;
}

// The widget's GetUniverse read: the generated Connect query (GET; key + cache policy
// owned by api-client/client-cache) mapped DTO→domain at the entity mapper seam, then
// written into the three entity stores every response (Query cache → store).
// `universe.universeTime` is the read-time-derivation input for @cosimosi/memory-logic —
// this unit never re-derives that math. Stores are data (§3.2); nothing here is per-frame.
// A fetch failure (401/500/network) throws to the widget's error boundary via throwOnError
// so it surfaces a retry instead of an indistinguishable empty universe; the stores are
// cleared when there is no universe so a prior user's data can't linger after sign-out.
export function useUniverse(): UniverseReadState {
  const transport = useTransport();
  const queryOptions = useMemo(() => createGetUniverseQueryOptions(transport), [transport]);
  const query = useQuery({...queryOptions, throwOnError: true});
  const universe = useMemo(() => (query.data ? universeFromResponse(query.data) : null), [query.data]);
  const setMemories = useEpisodicMemoryStore(state => state.setAll);
  const setNeurons = useNeuronStore(state => state.setAll);
  const setSynapses = useSynapseStore(state => state.setAll);

  useEffect(() => {
    setMemories(universe?.memories ?? []);
    setNeurons(universe?.neurons ?? []);
    setSynapses(universe?.synapses ?? []);
  }, [universe, setMemories, setNeurons, setSynapses]);

  return {universe};
}
