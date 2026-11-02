import type { DisclosureOwnProps } from './types.ts'

export function Disclosure({ label, children }: DisclosureOwnProps) {
  return (
    <details className="reading-disclosure">
      <summary className="w-fit rounded-md py-1 text-sm text-text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
        {label}
      </summary>
      <div className="mt-4 flex flex-col gap-4 rounded-xl bg-bg p-4">{children}</div>
    </details>
  )
}
