import { createContext, useContext } from 'react'

// The platform-pure error-toast seam: the context + hook are shared verbatim by web and mobile
// (promote-on-reuse); only the provider COMPONENT that renders the toast primitive is forked per
// platform, since it wires a DOM/native Toast. A host that calls useErrorToast outside its
// platform provider is a wiring bug — fail loud.
export type ShowErrorToast = (error: unknown) => void

export const ErrorToastContext = createContext<ShowErrorToast | null>(null)

export function useErrorToast(): ShowErrorToast {
  const showError = useContext(ErrorToastContext)
  if (!showError) throw new Error('useErrorToast must be used inside an error-toast provider')
  return showError
}
