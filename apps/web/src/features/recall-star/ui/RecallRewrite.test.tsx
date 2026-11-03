// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { useRecallDraftStore } from '@cosimosi/universe/testing'
import { RecallRewrite } from './RecallRewrite.tsx'
import { m } from '../../../shared/i18n/index.ts'

afterEach(cleanup)
it('edits only missing parts in context and requires all answers', async () => {
  const user = userEvent.setup()
  const confirm = vi.fn()
  useRecallDraftStore.getState().reset()
  useRecallDraftStore.getState().prepare([
    { text: 'I ', lost: false },
    { text: 'xxxx', lost: true },
    { text: ' at ', lost: false },
    { text: 'xxxx', lost: true },
    { text: ' today.', lost: false },
  ])
  function Passage() {
    const draft = useRecallDraftStore()
    return (
      <RecallRewrite
        parts={draft.parts}
        answers={draft.answers}
        onAnswer={draft.setAnswer}
        canConfirm={draft.rewrite !== ''}
        inputLocked={false}
        onConfirm={confirm}
        busy={false}
      />
    )
  }
  render(<Passage />)
  const fields = screen.getAllByRole('textbox')
  expect(fields).toHaveLength(2)
  const button = screen.getByRole('button', { name: m.recall_confirm() }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  await user.type(fields[0], 'met a friend')
  expect(button.disabled).toBe(true)
  await user.type(fields[1], 'home')
  expect(button.disabled).toBe(false)
  expect(useRecallDraftStore.getState().rewrite).toBe('I met a friend at home today.')
  await user.click(button)
  expect(confirm).toHaveBeenCalledOnce()
})
