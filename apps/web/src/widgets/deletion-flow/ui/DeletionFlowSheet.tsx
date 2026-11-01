import { useInvalidateAchievements } from '@cosimosi/achievement/react'
import { Dialog } from '@cosimosi/ui'
import { useErrorToast } from '@cosimosi/errors/react'
import { useDeletionFlowController, renderDeletionFlow } from '@cosimosi/universe/react/flows'
import { DeleteConfirm } from '../../../features/delete-memory/index.ts'
import { ApproveStep, PhrasingStep } from '../../../features/let-go/index.ts'
import { m } from '../../../shared/i18n/index.ts'

export function DeletionFlowSheet({ active = true }: { active?: boolean }) {
  return renderDeletionFlow(
    useDeletionFlowController({
      active,
      onError: useErrorToast(),
      invalidateAchievements: useInvalidateAchievements(),
    }),
    {
      dialog: (props) => <Dialog {...props} />,
      confirm: (props) => <DeleteConfirm key="delete" {...props} />,
      phrasing: (props) => <PhrasingStep key="phrase" {...props} />,
      approval: (props) => <ApproveStep key="approve" {...props} />,
    },
    {
      deletion: m.deletion_delete_title(),
      letGo: m.deletion_letgo_title(),
      cancel: m.deletion_cancel(),
    },
  )
}
