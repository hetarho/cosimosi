import { TextArea, TextField } from '@cosimosi/ui'
import { useDiaryDraftStore } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'

// features/write-diary ui: the diary body + date-picker bound to the draft store ([W5]). The date
// uses the platform date input (a web/native-forked primitive per §3.5). Copy is i18n.
export function WriteDiaryFields() {
  const body = useDiaryDraftStore((state) => state.body)
  const diaryDate = useDiaryDraftStore((state) => state.diaryDate)
  const setBody = useDiaryDraftStore((state) => state.setBody)
  const setDiaryDate = useDiaryDraftStore((state) => state.setDiaryDate)
  return (
    <div className="flex flex-col gap-4">
      <TextArea
        label={m.writing_flow_body_label()}
        placeholder={m.writing_flow_body_placeholder()}
        value={body}
        rows={6}
        onChange={(event) => setBody(event.target.value)}
      />
      <TextField
        type="date"
        label={m.writing_flow_date_label()}
        value={diaryDate}
        onChange={(event) => setDiaryDate(event.target.value)}
      />
    </div>
  )
}
