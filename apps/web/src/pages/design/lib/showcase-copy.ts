/**
 * Every string the design showcase renders.
 *
 * This is a dev-only review surface, so its copy is deliberately OUTSIDE the product i18n catalogue
 * — shipping label text for a page no user reaches would only pad the translator's work. Routing it
 * through one object keeps that exemption honest: the raw-string lint sees expressions, not
 * literals, and a reviewer can read the whole vocabulary of the showcase in one place.
 */
export const T = {
  // Shell
  title: 'Design language',
  subtitle:
    'The 2D language of the universe: the tokens it is built from, every primitive in every state, and the chrome those primitives compose into. What a design review reads.',
  navLabel: 'Showcase sections',
  activeTheme: 'Active theme',
  registeredThemes: 'Registered',
  themeAttribute: 'data-theme',

  // Groups
  groupFoundations: 'Foundations',
  groupPrimitives: 'Primitives',
  groupPatterns: 'Patterns',
  groupUniverse: 'Universe',

  // Foundations — theme
  themeTitle: 'Theme',
  themeBlurb:
    'A theme is a role map, not a palette of its own. Every colour below is a CSS variable the generator wrote from the registry — adding a universe is a data change in packages/ui and nothing else.',
  roleName: 'Role',
  roleValue: 'Authored value',

  contrastTitle: 'Contrast',
  contrastBlurb:
    'Every text pair the language uses, measured against its ground. AA for normal text is 4.5:1; the same pairs are gated in the token test, so a failing row here means a failing build.',
  contrastPass: 'AA',
  contrastFail: 'below AA',
  contrastAgainst: 'on',

  typeTitle: 'Typography',
  typeBlurb:
    'Six roles, one rhythm. Size carries hierarchy, weight carries emphasis, and the eyebrow carries category — never colour alone. Body copy is capped at the reading measure so the eye keeps finding the next line.',
  typeSpecimen: 'The universe remembers what you return to.',
  measureTitle: 'Reading measure',
  measureBody:
    'A paragraph capped at the measure token. Beyond roughly this width the eye loses the start of the next line, so every column of prose in the product — the diary body, a dialog description, an empty-state explanation — is bounded by it rather than by whatever the container happens to be.',

  spacingTitle: 'Spacing',
  spacingBlurb:
    'One scale, used at every altitude: gaps inside a control, padding inside a panel, gutters between panels. Density is chosen by picking a step, never by inventing a value between two.',

  radiusTitle: 'Radius',
  radiusBlurb:
    'Radius encodes size, not decoration: controls take md, panels take the larger steps, and full is reserved for pills and dots.',

  elevationTitle: 'Elevation',
  elevationBlurb:
    'Two materials, one depth model. Opaque surfaces step up from the ground for content that must stay readable; glass floats over the universe for chrome that should let it through. Both cast the theme’s own depth colour.',
  elevationShadows: 'Shadows',
  elevationSurfaces: 'Surfaces',
  cardSolidTitle: 'Solid',
  cardSolidBody: 'Content surface — lists, panels, forms. Opaque, so text never fights the scene.',
  cardGlassTitle: 'Glass',
  cardGlassBody: 'Floating chrome. The lit edge and the blur come from the theme, not from white.',
  glassSubtle: 'glass-subtle · ambient HUD',
  glassDefault: 'glass · panels',
  glassStrong: 'glass-strong · dialogs',

  motionTitle: 'Motion',
  motionBlurb:
    'Motion confirms a change; it never announces itself. Fast for state feedback, base for entering chrome, slow for a surface crossing the screen. Standard easing everywhere except a control that should feel picked up.',
  motionPlay: 'Play',
  motionReducedOn: 'Reduced motion is on — durations collapse to zero, nothing is lost.',
  motionReducedOff: 'Reduced motion is off.',

  focusTitle: 'Focus',
  focusBlurb:
    'Every interactive element takes the same ring: two pixels of focus-ring colour, offset two pixels from the control so it reads against any surface. Tab through the row — the ring must never be the thing you have to hunt for.',

  // Primitives
  primitiveStates: 'default · hover · focus · pressed · disabled',
  stateDefault: 'default',
  stateHover: 'hover',
  stateFocus: 'focus',
  statePressed: 'pressed',
  stateDisabled: 'disabled',
  stateLoading: 'loading',
  stateError: 'error',
  stateValid: 'valid',
  stateEmpty: 'empty',

  buttonTitle: 'Button',
  buttonBlurb:
    'Two independent axes: appearance carries emphasis, colour carries meaning. Any appearance composes with any colour, so a page never needs a one-off button.',
  buttonMatrix: 'Appearance × colour',
  buttonSizes: 'Sizes',
  buttonStates: 'States',
  buttonIcons: 'With icons',

  iconButtonTitle: 'Icon button',
  iconButtonBlurb:
    'The same two axes, square. It always carries an accessible name — an unlabeled icon is a guess.',

  badgeTitle: 'Badge',
  badgeBlurb:
    'Status, not decoration. Colour lives in the rim and the text, never in a solid fill, and a coloured dot never appears without its label.',
  badgeOnScene: 'Over the universe',

  fieldTitle: 'Fields',
  fieldBlurb:
    'A recessed well the scene reads through. Colour never enters the fill — validation rides the border and the ring.',
  fieldLabel: 'Label',
  fieldPlaceholder: 'Placeholder',
  fieldDescribed: 'With description',
  fieldDescription: 'Helper text sits under the field, before the error can replace it.',
  fieldInvalid: 'Invalid',
  fieldError: 'This field is required.',
  fieldDisabled: 'Disabled',
  textAreaLabel: 'Text area',
  textAreaPlaceholder: 'Multi-line input',
  selectLabel: 'Bounded choice',
  selectDescribed: 'With description',
  selectInvalid: 'Invalid',
  selectDisabled: 'Disabled',
  selectStates:
    'A real select element wearing the well — the platform menu and its keyboard are inherited, not rebuilt.',

  toggleTitle: 'Toggles',
  toggleBlurb:
    'A switch commits immediately; a checkbox waits for the form. The distinction is the reason both exist.',
  switchLabel: 'Notifications',
  switchDisabledLabel: 'Locked by policy',
  checkboxLabel: 'Remember this choice',
  checkboxDisabledLabel: 'Unavailable',

  overlayTitle: 'Overlays',
  overlayBlurb:
    'Chrome that arrives on top: a tooltip explains, a toast reports, a dialog interrupts. Each is glass, each is portalled, each returns focus where it found it.',
  tooltipTrigger: 'Hover or focus me',
  tooltipContent: 'A tooltip explains; it never carries the only copy of something.',
  toastTrigger: 'Show toast',
  toastBody: 'Saved.',
  dialogTrigger: 'Open dialog',
  dialogTitle: 'Release this star?',
  dialogBody:
    'The memory fades from the universe and the diary keeps its text. This cannot be undone.',
  dialogClose: 'Close',
  dialogDontAsk: 'Don’t ask again',
  dialogCancel: 'Cancel',
  dialogConfirm: 'Release',

  feedbackTitle: 'Feedback',
  feedbackBlurb:
    'What the interface shows while it has nothing to show. A skeleton holds the shape of what is coming; a spinner marks a control that is busy; an inline alert is the row that stays after the toast has gone.',
  skeletonLabel: 'Skeleton',
  spinnerLabel: 'Spinner',
  alertLabel: 'Inline alert',
  alertDanger: 'The stars did not rise. Nothing was saved — try again.',
  alertWarning:
    'This date is ahead of your universe’s present, so it is kept as a diary without lighting a star.',
  alertInfo: 'The universe advanced while you were writing.',
  alertSuccess: 'Your stars are up.',

  // Patterns
  writingTitle: 'Writing flow',
  writingBlurb:
    'The first screen anyone meets. One field, one action, and nothing competing with the text being written.',
  writingHeading: 'Write a diary',
  writingDate: 'Today',
  writingPlaceholder: 'What stayed with you today?',
  writingBody:
    'The rain stopped sometime in the afternoon and I did not notice until the light changed. I read the same page four times and kept none of it.',
  writingSplit: 'Split into stars',
  writingProposed: 'Proposed stars',
  writingLaunch: 'Send up the stars',
  writingBack: 'Back to writing',

  detailTitle: 'Star detail',
  detailBlurb:
    'The panel that opens over the universe — glass, so the star it describes stays visible behind it.',
  detailStrength: 'Strength',
  detailRecalled: 'Recalled 3× · last Y1 · D18',
  detailRecall: 'Recall',
  detailHistory: 'History',
  detailSource: 'Open the diary',
  detailBody: 'The water was the colour of old coins. We did not say much on the way back.',

  hudTitle: 'HUD',
  hudBlurb:
    'The only chrome that sits on the universe permanently, so it stays at the edges and stays quiet.',
  hudTime: 'Universe time · Y1 · D28',
  hudBalance: 'Twinkle · 42',
  hudWrite: 'Write',

  listTitle: 'List page',
  listBlurb:
    'The archive: dense enough to scan, spaced enough to read. Every row is the same three-part rhythm — identity, excerpt, status.',
  listHeading: 'Diary',
  listSearch: 'Search memories',
  listSortRecent: 'Recent',
  listSortStrongest: 'Strongest',
  listMemories: 'memories',
  listMore: 'More',
  listBack: 'Back',

  statesTitle: 'Empty · loading · error',
  statesBlurb:
    'The three screens a feature must design before it is finished. Each one says what happened and offers the next move; none of them apologises.',
  emptyHeading: 'No stars yet',
  emptyBody: 'The first diary you write becomes the first light in this universe.',
  emptyAction: 'Write the first one',
  loadingHeading: 'Loading the universe',
  errorHeading: 'The universe did not load',
  errorBody: 'The connection dropped before the stars arrived.',
  errorAction: 'Try again',

  // Universe — the 3D review surface
  starFormsTitle: 'Star forms',
  starFormsBlurb:
    'Every candidate body a memory star can wear, at one size and one brightness so only the form and its feeling differ. Drag to turn the scene, scroll to come closer.',
  skyTitle: 'Emotion skies',
  skyBlurb:
    'A shader-lit sphere enclosing the scene, not a wash behind it — look around inside it. Each sky arranges the same four axes differently, and every colour comes from the universe\u2019s own feelings. Hand any sky any number of emotions: more feelings means smaller territories, never a muddier wash.',
  skyEmotionCount: 'How many emotions',
  statesTitle3D: 'States',
  statesBlurb3D:
    'What a memory looks like as it is forgotten, as it rises, and as a neuron wakes. Three of the four are decisions to leave the design alone, and they say so — a state that should read as nothing is a design choice like any other.',
  statesForgettingLabel: 'Forgetting',
  statesForgettingNote:
    'One memory at five lengths of absence. Mood, strength and seed are identical across the row, so the only variable is time. It loses light and it loses MOVEMENT — never size, which is strength, and never hue or chroma, which are the feeling. Watch for a few seconds: a single frame cannot show it.',
  statesMotionLabel: 'Motion',
  statesElapsed: (days: number) => (days === 0 ? 'today' : `${days}d`),
  statesWordLossLabel: 'Word loss',
  statesWordLossNote:
    'Nothing here, deliberately. Brightness already says the memory has eroded; which words went is read up close, in the 2D hover glimpse and the star panel. Words are read, not seen from across a universe.',
  statesWordLossStages: [
    '첫 겨울 바다에서 헤엄쳤다',
    '첫 겨울 xxxx 헤엄쳤다',
    'xxxx xxxx xxxx 헤엄쳤다',
  ],
  statesStage: (index: number) => `stage ${index}`,
  statesGistLabel: 'Gist risen',
  statesGistNote:
    'Height alone. The pair is one memory twice: the left column is remembered only, the right has risen, so its gist bodies sit above their own original over the same x and y. That a second body exists above IS the relationship — a line between them would only crowd the sky, and dimming the original would spend forgetting\u2019s channel on abstraction.',
  statesGistLegend:
    'Left: episodic only. Right: two risen stages over their own star — softer the higher they go, and the original keeps its light.',
  statesAwakenLabel: 'Awakening',
  statesAwakenNote:
    'A grey latent mote is replaced by a white-gold flare that grows and hands off to the real neuron. It carries no emotion colour, which agrees with a neuron having no feeling. The flare is idempotent per neuron, so each press births a new one — a real launch flares once and never again.',
  statesAwakenReplay: 'Wake a neuron',
  statesAwakenLegend:
    'The flare lasts 1.1 seconds and takes its mote with it. Whether that reads on a phone is still an on-device question.',

  ambientTitle: 'Ambient bodies',
  ambientBlurb:
    'The three bodies a universe is mostly made of, read together because each is defined against the others. None of them carries a feeling — colour is the one thing here that is not a variable.',
  ambientLabel: 'Neuron, synapse, latent dust',
  ambientNote:
    'A neuron is a membrane that holds still; a synapse is a cord whose light runs inward from both ends, never one way, because it joins an A and a B rather than a from and a to; the dust is what has not become anything yet. Turn the motion off and only the neuron looks unchanged \u2014 that is the design.',
  ambientLegend: [
    { term: 'Cell-star', detail: 'The neuron: dim inside, lit at its own silhouette. Motionless.' },
    {
      term: 'Filament',
      detail:
        'Three synapses, strong to faint. Width is strength; the shimmer meets in the middle.',
    },
    {
      term: 'Latent field',
      detail: 'Dust that pools where it clumps and breathes on its own phase.',
    },
  ],

  nebulaTitle: 'Emotion colour field',
  nebulaBlurb:
    'The nebula is not a body. It is what a region of the universe looks like when the memories in it bleed their colour into the space between them.',

  // Demo data
  moodLabels: {
    JOY: 'Joy',
    CALM: 'Calm',
    SAD: 'Sad',
    ANGER: 'Anger',
    FEAR: 'Fear',
    LOVE: 'Love',
    NEUTRAL: 'Neutral',
    EXCITEMENT: 'Excitement',
    GRATITUDE: 'Gratitude',
    RELIEF: 'Relief',
    STRESS: 'Stress',
    TIRED: 'Tired',
    EMPTINESS: 'Emptiness',
  },
} as const
