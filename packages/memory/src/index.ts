// @cosimosi/memory — the shared FE domain mirror of the universe read model:
// episodic memory · neuron · synapse types + the GetUniverse proto→domain mappers.
// Pure (no three, no DOM, no visual vocabulary); web and mobile consume it verbatim.
export type { EpisodicMemory, NeuronActivation } from './episodic-memory.ts'
export { NEURON_TYPES, isNeuronType, type Neuron, type NeuronType } from './neuron.ts'
export type { Synapse } from './synapse.ts'
export { sameFacts, sameRecords, sameUniverseSnapshot } from './equality.ts'
export {
  emotionFromDto,
  episodicMemoryFromDto,
  neuronFromDto,
  synapseFromDto,
  universeFromResponse,
  type UniverseSnapshot,
} from './mappers.ts'
export {
  DIARY_MEMORY_COUNT_ALL,
  diariesFromDtos,
  diaryDaysFromDtos,
  diaryMemoryCountOption,
  diaryMemoryCountOptions,
  diaryMemoryCountRange,
  diaryMoods,
  diaryPreview,
  highlightSegments,
  isKeywordSearchable,
  shouldAdoptCommitted,
  type Diary,
  type DiaryDay,
  type DiaryDayMood,
  type DiaryMemoryCountRange,
  type DiarySplitMember,
  type DiaryTextSegment,
} from './diary.ts'
export {
  requestReviseSplit,
  type ProposedMemoryInput,
  type ReviseSplitInput,
} from './revise-split.ts'
export { requestSplitDiary, type SplitDiaryInput } from './split-diary.ts'
export type { ProvenanceEntry, ProvenanceKind, ProvenanceSource } from './provenance.ts'
