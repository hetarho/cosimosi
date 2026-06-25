import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** shadcn/ui 표준 className 병합 유틸 (clsx로 조건부 결합 → tailwind-merge로 충돌 해소). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
