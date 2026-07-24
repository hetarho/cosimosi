import { useCallback, useState, type ReactNode } from 'react'

import { VALUES } from '@cosimosi/config'
import { presentAppError, type ErrorPresentation } from '@cosimosi/errors'
import { Toast } from '@cosimosi/ui'

import { ErrorToastContext } from '../../shared/model/index.ts'

interface WebErrorProviderProps {
  children?: ReactNode
}

export function WebErrorProvider({ children }: WebErrorProviderProps) {
  const [presentation, setPresentation] = useState<ErrorPresentation | null>(null)
  const showError = useCallback((error: unknown) => {
    setPresentation(presentAppError(error))
  }, [])

  return (
    <ErrorToastContext.Provider value={showError}>
      {children}
      <Toast
        open={presentation !== null}
        onOpenChange={(open) => {
          if (!open) setPresentation(null)
        }}
        variant={presentation?.severity}
        durationMs={VALUES.errors.toastAutoDismissMs}
      >
        {presentation?.message}
      </Toast>
    </ErrorToastContext.Provider>
  )
}
