import { useMemo, useState } from 'react'

import { Badge, Button } from '@cosimosi/ui'

import { m, useActiveLocale } from '../../../shared/i18n/index.ts'
import {
  capabilityMessageKeys,
  createCapabilitySet,
  getMissingCapabilities,
  isPanelAvailable,
  readTestPanelMessage,
  type TestPanelCapability,
  type TestPanelDefinition,
} from '../../../shared/test-panel/index.ts'
import { PHASE_ONE_TEST_CAPABILITIES, platformTestPanels } from '../lib/platform-panels.ts'

const ACTIVE_PANEL_ARIA_CURRENT = 'page' as const

interface TestPageProps {
  panels?: readonly TestPanelDefinition[]
  availableCapabilities?: readonly TestPanelCapability[]
}

export function TestPage({
  panels = platformTestPanels,
  availableCapabilities = PHASE_ONE_TEST_CAPABILITIES,
}: TestPageProps) {
  useActiveLocale()
  const capabilities = useMemo(
    () => createCapabilitySet(availableCapabilities),
    [availableCapabilities],
  )
  const [selectedPanelId, setSelectedPanelId] = useState(() => panels[0]?.id ?? '')
  const selectedPanel = panels.find((panel) => panel.id === selectedPanelId) ?? panels[0]
  const missingCapabilities = selectedPanel
    ? getMissingCapabilities(selectedPanel, capabilities)
    : []
  const selectedPanelAvailable = selectedPanel
    ? isPanelAvailable(selectedPanel, capabilities)
    : false

  return (
    <main className="min-h-dvh bg-background text-text">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 md:grid-cols-[9rem_1fr] md:px-6">
        <header className="md:col-span-2">
          <Badge variant="primary">{m.test_harness_route_badge()}</Badge>
          <div className="mt-3 max-w-3xl">
            <h1 className="text-3xl font-semibold">{m.test_harness_title()}</h1>
            <p className="mt-2 text-sm leading-6 text-text-muted">{m.test_harness_description()}</p>
          </div>
        </header>

        <aside aria-label={m.test_harness_panel_list_label()} className="flex flex-col gap-2">
          {panels.map((panel) => {
            const selected = panel.id === selectedPanel?.id
            const available = isPanelAvailable(panel, capabilities)
            return (
              <Button
                key={panel.id}
                onClick={() => setSelectedPanelId(panel.id)}
                color={selected ? 'primary' : 'neutral'}
                className="justify-start"
                aria-current={selected ? ACTIVE_PANEL_ARIA_CURRENT : undefined}
              >
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span className="truncate">{readTestPanelMessage(panel.titleKey)}</span>
                  <span className="text-xs opacity-80">
                    {available
                      ? m.test_harness_available_badge()
                      : m.test_harness_unavailable_badge()}
                  </span>
                </span>
              </Button>
            )
          })}
        </aside>

        <section className="card-surface min-w-0 rounded-2xl p-4">
          {selectedPanel ? (
            <article className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 border-b border-border pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold">
                    {readTestPanelMessage(selectedPanel.titleKey)}
                  </h2>
                  <Badge variant={selectedPanelAvailable ? 'success' : 'warning'}>
                    {selectedPanelAvailable
                      ? m.test_harness_available_badge()
                      : m.test_harness_unavailable_badge()}
                  </Badge>
                </div>
                {selectedPanel.descriptionKey ? (
                  <p className="text-sm leading-6 text-text-muted">
                    {readTestPanelMessage(selectedPanel.descriptionKey)}
                  </p>
                ) : null}
              </div>
              {selectedPanelAvailable ? (
                selectedPanel.render({ panel: selectedPanel })
              ) : (
                <UnavailablePanel panel={selectedPanel} missingCapabilities={missingCapabilities} />
              )}
            </article>
          ) : (
            <p className="text-sm text-text-muted">{m.test_harness_no_panels()}</p>
          )}
        </section>
      </div>
    </main>
  )
}

function UnavailablePanel({
  panel,
  missingCapabilities,
}: {
  panel: TestPanelDefinition
  missingCapabilities: readonly TestPanelCapability[]
}) {
  return (
    <div className="rounded-md border border-border bg-surface-subtle p-4" role="status">
      <p className="font-medium">{m.test_harness_panel_unavailable_title()}</p>
      <p className="mt-2 text-sm leading-6 text-text-muted">
        {m.test_harness_panel_unavailable_description()}
      </p>
      <div className="mt-4">
        <p className="text-sm font-medium text-text-muted">
          {m.test_harness_missing_capabilities()}
        </p>
        <ul className="mt-2 grid gap-2">
          {missingCapabilities.map((capability) => (
            <li
              key={`${panel.id}-${capability}`}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              {readTestPanelMessage(capabilityMessageKeys[capability])}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
