import { fireEvent, render } from '@testing-library/react-native'
import { useRecallDraftStore } from '@cosimosi/universe/testing'
import { RecallRewrite } from './RecallRewrite.tsx'
import { m } from '../../../shared/i18n/index.ts'

it('keeps legible words read-only and assembles only the supplied missing part', () => {
  const confirm = jest.fn()
  useRecallDraftStore.getState().reset()
  useRecallDraftStore.getState().prepare([
    { text: 'I ', lost: false },
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
  const view = render(<Passage />)
  expect(view.getByRole('button').props.accessibilityState.disabled).toBe(true)
  fireEvent.changeText(view.getByLabelText(m.recall_blank_label({ position: 1 })), 'met a friend')
  expect(useRecallDraftStore.getState().rewrite).toBe('I met a friend today.')
  fireEvent.press(view.getByText(m.recall_confirm()))
  expect(confirm).toHaveBeenCalledTimes(1)
})
