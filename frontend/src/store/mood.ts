import { create } from 'zustand'

export type Mood = 'calm' | 'joy' | 'storm' | 'melancholy' | 'wonder'

export type MoodPalette = {
  primary: string
  secondary: string
  accent: string
  bloomIntensity: number
  particleSpeed: number
}

export const palettes: Record<Mood, MoodPalette> = {
  calm: {
    primary: '#7fb3ff',
    secondary: '#a3e4d7',
    accent: '#dfe9ff',
    bloomIntensity: 0.6,
    particleSpeed: 0.15,
  },
  joy: {
    primary: '#ffb86b',
    secondary: '#ff7eb9',
    accent: '#ffe066',
    bloomIntensity: 1.4,
    particleSpeed: 0.6,
  },
  storm: {
    primary: '#5a4cff',
    secondary: '#1b1140',
    accent: '#c2a3ff',
    bloomIntensity: 1.1,
    particleSpeed: 0.9,
  },
  melancholy: {
    primary: '#4f6d8c',
    secondary: '#2a2438',
    accent: '#8a99c2',
    bloomIntensity: 0.5,
    particleSpeed: 0.1,
  },
  wonder: {
    primary: '#9c6bff',
    secondary: '#3affc1',
    accent: '#ffd1ff',
    bloomIntensity: 1.0,
    particleSpeed: 0.4,
  },
}

type MoodState = {
  mood: Mood
  setMood: (m: Mood) => void
  palette: () => MoodPalette
}

export const useMoodStore = create<MoodState>((set, get) => ({
  mood: 'calm',
  setMood: (mood) => set({ mood }),
  palette: () => palettes[get().mood],
}))
