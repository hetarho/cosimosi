import { Component, createContext, useContext, useRef, useSyncExternalStore, type ReactNode } from 'react'

import { createObservabilityFacade, type ObservabilityFacade, type ObservabilitySnapshot } from './facade.ts'

const ObservabilityContext = createContext<ObservabilityFacade | null>(null)

interface ObservabilityProviderProps {
  children?: ReactNode
  facade?: ObservabilityFacade
}

export function ObservabilityProvider({ children, facade }: ObservabilityProviderProps) {
  const ownedFacade = useRef<ObservabilityFacade | null>(null)
  if (!facade && !ownedFacade.current) ownedFacade.current = createObservabilityFacade()
  return <ObservabilityContext.Provider value={facade ?? ownedFacade.current}>{children}</ObservabilityContext.Provider>
}

export function useObservabilityFacade(): ObservabilityFacade {
  const facade = useContext(ObservabilityContext)
  if (!facade) throw new Error('useObservabilityFacade must be used inside ObservabilityProvider')
  return facade
}

export function useObservabilitySnapshot(): ObservabilitySnapshot {
  const facade = useObservabilityFacade()
  return useSyncExternalStore(facade.subscribe, () => facade.snapshot, () => facade.snapshot)
}

export interface ObservedErrorBoundaryFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

type ObservedErrorBoundaryFallback = ReactNode | ((props: ObservedErrorBoundaryFallbackProps) => ReactNode)

interface ObservedErrorBoundaryProps {
  children?: ReactNode
  facade: ObservabilityFacade
  fallback?: ObservedErrorBoundaryFallback
  onReset?: () => void
  resetKeys?: readonly unknown[]
}

interface ObservedErrorBoundaryState {
  error: Error | null
}

class ObservedErrorBoundaryImpl extends Component<ObservedErrorBoundaryProps, ObservedErrorBoundaryState> {
  state: ObservedErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ObservedErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    this.props.facade.captureException(error, {
      source: 'react-error-boundary',
      properties: {
        componentStack: info.componentStack ?? null,
      },
    })
  }

  componentDidUpdate(prevProps: ObservedErrorBoundaryProps): void {
    if (this.state.error && haveResetKeysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.resetErrorBoundary()
    }
  }

  private resetErrorBoundary = () => {
    this.props.onReset?.()
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback({ error: this.state.error, resetErrorBoundary: this.resetErrorBoundary })
      }
      return this.props.fallback ?? null
    }
    return this.props.children
  }
}

export function ObservedErrorBoundary({ children, fallback, onReset, resetKeys }: Omit<ObservedErrorBoundaryProps, 'facade'>) {
  const facade = useObservabilityFacade()
  return (
    <ObservedErrorBoundaryImpl facade={facade} fallback={fallback} onReset={onReset} resetKeys={resetKeys}>
      {children}
    </ObservedErrorBoundaryImpl>
  )
}

function haveResetKeysChanged(previous: readonly unknown[] | undefined, next: readonly unknown[] | undefined): boolean {
  if (!previous || !next || previous.length !== next.length) return previous !== next
  return previous.some((value, index) => !Object.is(value, next[index]))
}
