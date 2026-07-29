import { m } from '@cosimosi/i18n'

import { AchievementAxis } from './achievement.ts'

// The id→copy projection, in the shape `packages/emotion/src/mood-label.ts` established: a Record of
// STATIC message accessors, so `gen:messages`, `check:gen` and `lint:raw-strings` all see every key
// this surface can render. A constructed key like `m[`achievement_${id}_title`]` would be invisible
// to all three, and a missing string would surface as a blank row nobody notices.
//
// The wire carries ids, integers and enums only — no title, no body, no axis label — so this file is
// where an achievement gets its words. That separation is why re-wording one is a copy change with no
// deploy of the server.

interface AchievementCopy {
  title: () => string
  body: () => string
}

const ACHIEVEMENT_COPY: Record<string, AchievementCopy> = {
  first_diary: { title: m.achievement_first_diary_title, body: m.achievement_first_diary_body },
  first_star: { title: m.achievement_first_star_title, body: m.achievement_first_star_body },
  first_recall: { title: m.achievement_first_recall_title, body: m.achievement_first_recall_body },
  first_gist_view: {
    title: m.achievement_first_gist_view_title,
    body: m.achievement_first_gist_view_body,
  },
  first_shared_neuron: {
    title: m.achievement_first_shared_neuron_title,
    body: m.achievement_first_shared_neuron_body,
  },
  first_release: {
    title: m.achievement_first_release_title,
    body: m.achievement_first_release_body,
  },
  first_decoration: {
    title: m.achievement_first_decoration_title,
    body: m.achievement_first_decoration_body,
  },
  first_invite: { title: m.achievement_first_invite_title, body: m.achievement_first_invite_body },

  diary_5: { title: m.achievement_diary_5_title, body: m.achievement_diary_5_body },
  diary_20: { title: m.achievement_diary_20_title, body: m.achievement_diary_20_body },
  diary_50: { title: m.achievement_diary_50_title, body: m.achievement_diary_50_body },
  diary_200: { title: m.achievement_diary_200_title, body: m.achievement_diary_200_body },

  star_10: { title: m.achievement_star_10_title, body: m.achievement_star_10_body },
  star_50: { title: m.achievement_star_50_title, body: m.achievement_star_50_body },
  star_200: { title: m.achievement_star_200_title, body: m.achievement_star_200_body },
  star_500: { title: m.achievement_star_500_title, body: m.achievement_star_500_body },

  recall_10: { title: m.achievement_recall_10_title, body: m.achievement_recall_10_body },
  recall_50: { title: m.achievement_recall_50_title, body: m.achievement_recall_50_body },
  recall_200: { title: m.achievement_recall_200_title, body: m.achievement_recall_200_body },
  recall_500: { title: m.achievement_recall_500_title, body: m.achievement_recall_500_body },

  gist_stage_1: { title: m.achievement_gist_stage_1_title, body: m.achievement_gist_stage_1_body },
  gist_stage_2: { title: m.achievement_gist_stage_2_title, body: m.achievement_gist_stage_2_body },
  gist_stage_3: { title: m.achievement_gist_stage_3_title, body: m.achievement_gist_stage_3_body },
  gist_stage_4: { title: m.achievement_gist_stage_4_title, body: m.achievement_gist_stage_4_body },

  recovery_1: { title: m.achievement_recovery_1_title, body: m.achievement_recovery_1_body },
  recovery_5: { title: m.achievement_recovery_5_title, body: m.achievement_recovery_5_body },
  recovery_20: { title: m.achievement_recovery_20_title, body: m.achievement_recovery_20_body },

  shared_neuron_3: {
    title: m.achievement_shared_neuron_3_title,
    body: m.achievement_shared_neuron_3_body,
  },
  shared_neuron_5: {
    title: m.achievement_shared_neuron_5_title,
    body: m.achievement_shared_neuron_5_body,
  },
  shared_neuron_8: {
    title: m.achievement_shared_neuron_8_title,
    body: m.achievement_shared_neuron_8_body,
  },

  mood_variety_5: {
    title: m.achievement_mood_variety_5_title,
    body: m.achievement_mood_variety_5_body,
  },
  mood_variety_9: {
    title: m.achievement_mood_variety_9_title,
    body: m.achievement_mood_variety_9_body,
  },
  mood_variety_13: {
    title: m.achievement_mood_variety_13_title,
    body: m.achievement_mood_variety_13_body,
  },

  decoration_5: { title: m.achievement_decoration_5_title, body: m.achievement_decoration_5_body },
  decoration_20: {
    title: m.achievement_decoration_20_title,
    body: m.achievement_decoration_20_body,
  },
  ornament_3: { title: m.achievement_ornament_3_title, body: m.achievement_ornament_3_body },
  ornament_8: { title: m.achievement_ornament_8_title, body: m.achievement_ornament_8_body },
  ornament_15: { title: m.achievement_ornament_15_title, body: m.achievement_ornament_15_body },
  ornament_kind_2: {
    title: m.achievement_ornament_kind_2_title,
    body: m.achievement_ornament_kind_2_body,
  },
}

// An id with no copy entry falls back to a plain label and KEEPS its progress and its claim button.
// The split is deliberate: copy completeness is a content gate, claimability is a correctness one —
// a server that added a row before its words shipped must not hold a reward hostage.
export function achievementTitle(id: string): string {
  return (ACHIEVEMENT_COPY[id]?.title ?? m.achievement_untitled)()
}

export function achievementBody(id: string): string {
  return ACHIEVEMENT_COPY[id]?.body() ?? ''
}

export function hasAchievementCopy(id: string): boolean {
  return id in ACHIEVEMENT_COPY
}

// A heading needs a heading's fallback, not a row's: an axis this build does not know still renders its
// rows (a row that renders nowhere is a reward nobody can claim), so it needs a word that reads as a
// group name rather than "an achievement without a name".
const AXIS_LABELS: Record<AchievementAxis, () => string> = {
  [AchievementAxis.UNSPECIFIED]: m.achievement_axis_other,
  [AchievementAxis.FIRST_EXPERIENCE]: m.achievement_axis_first_experience,
  [AchievementAxis.DIARY_TOTAL]: m.achievement_axis_diary_total,
  [AchievementAxis.STAR_TOTAL]: m.achievement_axis_star_total,
  [AchievementAxis.RECALL_TOTAL]: m.achievement_axis_recall_total,
  [AchievementAxis.GIST_DEPTH]: m.achievement_axis_gist_depth,
  [AchievementAxis.FORGETTING_RECOVERY]: m.achievement_axis_forgetting_recovery,
  [AchievementAxis.NEURON_SHARING]: m.achievement_axis_neuron_sharing,
  [AchievementAxis.MOOD_VARIETY]: m.achievement_axis_mood_variety,
  [AchievementAxis.DECORATION]: m.achievement_axis_decoration,
}

export function axisLabel(axis: AchievementAxis): string {
  return (AXIS_LABELS[axis] ?? m.achievement_axis_other)()
}
