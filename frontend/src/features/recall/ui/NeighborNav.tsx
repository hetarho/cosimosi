// Neighbor navigation (spec 11, 1.12). Reads the edges incident to the selected star
// from the 11-introduced edge store (neighborsOf), strongest first. Clicking a
// neighbor selects it → MemoryPanel re-dwells → that ≥2s view pairs with this one
// (co-recall, 1.3). Weight drives a width hint (thicker = stronger link).
//
// NOTE: the spec's T018 also calls for a camera fly-to on click; that needs a
// camera-target mechanism the canvas doesn't expose yet (useCameraMode only toggles
// nebula/recall), so navigation here is selection-only — fly-to is deferred to 12.
import { useMemo } from 'react'
import { neighborsOf, useSynapseStore } from '@/entities/synapse'
import { useMemoryStore } from '@/entities/memory'
import { moodLabel } from '@/shared/config'

const MAX_NEIGHBORS = 8

export function NeighborNav() {
  const selectedId = useMemoryStore((s) => s.selectedId)
  const stars = useMemoryStore((s) => s.stars)
  const select = useMemoryStore((s) => s.select)
  const edges = useSynapseStore((s) => s.edges)

  const neighbors = useMemo(() => {
    if (!selectedId) return []
    const byId = new Map(stars.map((s) => [s.id, s])) // O(1) lookup instead of find() per row
    return neighborsOf(edges, selectedId)
      .map((e) => {
        const id = e.aId === selectedId ? e.bId : e.aId
        return { id, weight: e.weight, star: byId.get(id) }
      })
      // only navigate to stars actually loaded in the universe (drop dangling endpoints)
      .filter((n) => n.star != null)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_NEIGHBORS)
  }, [edges, selectedId, stars])

  if (!selectedId || neighbors.length === 0) return null

  return (
    <nav className="flex flex-col gap-1.5 border-t border-white/10 pt-3">
      <p className="text-xs text-white/40">이웃으로 항해</p>
      <ul className="flex flex-col gap-1">
        {neighbors.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => select(n.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-white/70 transition hover:bg-white/10"
            >
              <span
                className="h-1.5 rounded-full bg-white/60"
                style={{ width: `${Math.round(8 + n.weight * 40)}px` }}
              />
              <span className="text-white/80">{moodLabel(n.star!.memory.mood)}</span>
              <span className="ml-auto text-white/35">{n.weight.toFixed(2)}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
