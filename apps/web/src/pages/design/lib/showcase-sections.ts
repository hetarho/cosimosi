import { T } from './showcase-copy.ts'

/**
 * The sidebar's contents — the map of the showcase.
 *
 * Kept apart from the panels so the navigation and the page cannot disagree about what exists: the
 * anchors here are the ids the `Section` components render, and a section added without an entry
 * simply cannot be reached from the sidebar (the test below asserts the two stay in step).
 */
export interface ShowcaseGroup {
  readonly label: string
  readonly sections: readonly { readonly id: string; readonly label: string }[]
}

export const SHOWCASE_GROUPS: readonly ShowcaseGroup[] = [
  {
    label: T.groupFoundations,
    sections: [
      { id: 'theme', label: T.themeTitle },
      { id: 'contrast', label: T.contrastTitle },
      { id: 'type', label: T.typeTitle },
      { id: 'spacing', label: T.spacingTitle },
      { id: 'elevation', label: T.elevationTitle },
      { id: 'motion', label: T.motionTitle },
      { id: 'focus', label: T.focusTitle },
    ],
  },
  {
    label: T.groupPrimitives,
    sections: [
      { id: 'button', label: T.buttonTitle },
      { id: 'icon-button', label: T.iconButtonTitle },
      { id: 'badge', label: T.badgeTitle },
      { id: 'field', label: T.fieldTitle },
      { id: 'toggle', label: T.toggleTitle },
      { id: 'overlay', label: T.overlayTitle },
      { id: 'feedback', label: T.feedbackTitle },
    ],
  },
  {
    label: T.groupPatterns,
    sections: [
      { id: 'writing', label: T.writingTitle },
      { id: 'detail', label: T.detailTitle },
      { id: 'hud', label: T.hudTitle },
      { id: 'list', label: T.listTitle },
      { id: 'states', label: T.statesTitle },
    ],
  },
]

export const SHOWCASE_SECTION_IDS = SHOWCASE_GROUPS.flatMap((group) =>
  group.sections.map((section) => section.id),
)
