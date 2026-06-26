/** cosimosi 감정→색 팔레트 (랜딩/우주 공용). hex 문자열. */
export const MOOD = {
  violet: '#7f77dd',
  teal: '#1d9e75',
  coral: '#d85a30',
  pink: '#d4537e',
  amber: '#ef9f27',
} as const

export type MoodKey = keyof typeof MOOD
