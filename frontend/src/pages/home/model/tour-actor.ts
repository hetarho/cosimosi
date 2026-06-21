import { VALUES } from '@/shared/config'
import {
  navigationActor,
  navTravel,
  selectHeadingMode,
  type NavTravel,
} from '@/widgets/universe-canvas'
import { tourMachine, type NavSamplerInput } from '@/widgets/demo-tour'
import { createActor, fromCallback, type EventObject } from 'xstate'

function practiceMet(awaitId: NavSamplerInput['awaitId'], mode: 'nebula' | 'recall', base: NavTravel): boolean {
  const travel = navTravel()
  const t = VALUES.demoTour
  switch (awaitId) {
    case 'nebula-rotated':
      return mode === 'nebula' && travel.orbit - base.orbit >= t.rotateThresholdRad
    case 'nebula-zoomed':
      return mode === 'nebula' && travel.zoom - base.zoom >= t.zoomRatioThreshold
    case 'recall-looked':
      return mode === 'recall' && travel.look - base.look >= t.lookThresholdRad
    case 'recall-thrusted':
      return mode === 'recall' && travel.thrust - base.thrust >= t.thrustDistanceThreshold
    default:
      return false
  }
}

const tourLogic = tourMachine.provide({
  actors: {
    navSampler: fromCallback<EventObject, NavSamplerInput>(({ input, sendBack }) => {
      if (input.awaitId == null) return
      const base = navTravel()
      let raf = 0
      const tick = () => {
        const mode = selectHeadingMode(navigationActor.getSnapshot())
        if (practiceMet(input.awaitId, mode, base)) {
          sendBack({ type: 'PRACTICE_MET' })
          return
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(raf)
    }),
  },
})

export const tourActor = createActor(tourLogic, { input: {} })
tourActor.start()
