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
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
}

// The widget's GetUniverse read: the generated Connect query (GET; key + cache policy
// owned by api-client/client-cache) mapped DTO→domain at the entity mapper seam, then
// written into the three entity stores once per response (Query cache → store).
// `universe.universeTime` is the read-time-derivation input for @cosimosi/memory-logic —
// this unit never re-derives that math. Stores are data (§3.2); nothing here is per-frame.
export function useUniverse(): UniverseReadState {
  const transport = useTransport();
  const queryOptions = useMemo(() => createGetUniverseQueryOptions(transport), [transport]);
  const query = useQuery(queryOptions);
  const universe = useMemo(() => (query.data ? universeFromResponse(query.data) : null), [query.data]);
  const setMemories = useEpisodicMemoryStore(state => state.setAll);
  const setNeurons = useNeuronStore(state => state.setAll);
  const setSynapses = useSynapseStore(state => state.setAll);

  useEffect(() => {
    if (!universe) {
      return;
    }
    setMemories(universe.memories);
    setNeurons(universe.neurons);
    setSynapses(universe.synapses);
  }, [universe, setMemories, setNeurons, setSynapses]);

  return {
    universe,
    isPending: query.isPending,
    isError: query.isError,
    refetch: () => {
      query.refetch().catch(() => undefined);
    },
  };
}
