import type { HTMLAttributes } from 'react'

import { cx } from '../lib/cx.ts'
import type { CardOwnProps } from './types.ts'

export type CardProps = CardOwnProps & HTMLAttributes<HTMLDivElement>

// The design-system surface container. `solid` is an elevated *opaque* content panel — content
// must stay legible, so glass is reserved for floating chrome — while `glass` uses the shared glass
// material for cards that float over the live universe / a rich backdrop. Radius + padding are baked
// for a consistent surface; `className` overrides (Tailwind utilities win over the components layer).
const VARIANTS: Record<NonNullable<CardOwnProps['variant']>, string> = {
  solid: 'card-surface',
  glass: 'glass',
}

export function Card({ variant = 'solid', className, children, ...rest }: CardProps) {
  return (
    <div className={cx('rounded-2xl p-4 text-text', VARIANTS[variant], className)} {...rest}>
      {children}
    </div>
  )
}
