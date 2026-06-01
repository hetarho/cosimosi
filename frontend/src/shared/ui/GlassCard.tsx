import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib'

/** 글래스모피즘 카드 (반투명 + backdrop blur + 미세 보더). `.glass`는 전역 CSS에 정의됨. */
export function GlassCard({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('glass rounded-3xl', className)} {...props} />
}
