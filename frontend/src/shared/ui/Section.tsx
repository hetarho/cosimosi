import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/shared/lib'

interface SectionProps {
  id?: string
  className?: string
  children: ReactNode
}

/** 스크롤 진입 시 페이드+슬라이드업 리빌. prefers-reduced-motion이면 모션 생략. */
export function Section({ id, className, children }: SectionProps) {
  const reduce = useReducedMotion()
  return (
    <motion.section
      id={id}
      className={cn('relative mx-auto w-full max-w-5xl px-6 py-20 sm:py-28', className)}
      initial={reduce ? false : { opacity: 0, y: 36 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
    >
      {children}
    </motion.section>
  )
}
