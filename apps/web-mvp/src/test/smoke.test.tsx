import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { cn } from '@/shared/lib'

// 보일러플레이트 테스트 스택 sanity (vitest + jsdom + RTL + jest-dom).
describe('boilerplate smoke', () => {
  it('cn이 tailwind 클래스를 병합한다 (vitest 러너 + @ alias)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('jsdom + RTL + jest-dom 매처가 동작한다', () => {
    render(<div>우주</div>)
    expect(screen.getByText('우주')).toBeInTheDocument()
  })
})
