import type { DiaryDto } from '@cosimosi/api-client'

export interface DiarySplitMember {
  readonly episodicMemoryId: string
  readonly name: string
  readonly mood: string
}

export interface Diary {
  readonly id: string
  readonly body: string
  readonly diaryDate: string
  readonly createdUniverseTime: string
  readonly memories: readonly DiarySplitMember[]
}

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
