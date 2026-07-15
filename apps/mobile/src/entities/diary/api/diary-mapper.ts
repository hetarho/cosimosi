import type { DiaryDto } from '@cosimosi/api-client'
import { useDiaryStore, type Diary } from '@cosimosi/universe'

// entities/diary api: maps the GetDiaries read DTOs into the shared diary read-model (§3.4
// proto→domain). The body is carried verbatim ([I2][D4]) and the split membership is copied
// as-is (soft-deleted memories already excluded server-side, so an all-let-go diary maps to an
// empty member list, [D3]). No derived or mutated value is introduced here.
export function diariesFromDtos(dtos: readonly DiaryDto[]): Diary[] {
  return dtos.map((dto) => ({
    id: dto.id,
    body: dto.body,
    diaryDate: dto.diaryDate,
    createdUniverseTime: dto.createdUniverseTime,
    memories: dto.memories.map((member) => ({
      episodicMemoryId: member.episodicMemoryId,
      name: member.name,
      mood: member.mood,
    })),
  }))
}

// Fills the shared read-model from the loaded archive (Query cache → store). Reading is free
// ([D2]) — this write carries no clock and no spend.
export function fillDiaryStore(diaries: readonly Diary[]): void {
  useDiaryStore.getState().setAll(diaries)
}
