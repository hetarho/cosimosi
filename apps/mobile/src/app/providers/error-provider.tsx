import { useCallback, useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { VALUES } from '@cosimosi/config'
import { presentAppError, type ErrorPresentation } from '@cosimosi/errors'
import { Toast } from '@cosimosi/ui'

import { ErrorToastContext } from '../../shared/model/index.ts'

interface MobileErrorProviderProps {
  children?: ReactNode
}

export function MobileErrorProvider({ children }: MobileErrorProviderProps) {
  const [presentation, setPresentation] = useState<ErrorPresentation | null>(null)
  const showError = useCallback((error: unknown) => {
    setPresentation(presentAppError(error))
  }, [])

  return (
    <ErrorToastContext.Provider value={showError}>
      {children}
      <View style={styles.toastHost}>
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
      </View>
    </ErrorToastContext.Provider>
  )
}

const styles = StyleSheet.create({
  toastHost: {
    bottom: 24,
    left: 16,
    position: 'absolute',
    pointerEvents: 'box-none',
    right: 16,
    zIndex: 100,
  },
})
