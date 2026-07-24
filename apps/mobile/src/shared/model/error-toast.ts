import { createContext, useContext } from 'react'

export type ShowErrorToast = (error: unknown) => void

export const ErrorToastContext = createContext<ShowErrorToast | null>(null)

export function useErrorToast(): ShowErrorToast {
  const showError = useContext(ErrorToastContext)
  if (!showError) throw new Error('useErrorToast must be used inside MobileErrorProvider')
  return showError
}
