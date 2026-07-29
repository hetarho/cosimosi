/**
 * Every string the native design showcase renders.
 *
 * A dev-only review surface, so its copy stays OUTSIDE the product i18n catalogue — shipping labels
 * for a screen no user reaches would only pad the translator's work. One object keeps that exemption
 * honest and lets a reviewer read the whole vocabulary in one place.
 *
 * It is deliberately NOT a copy of the web table: this surface says the things only the native side
 * has to say — which states a touch device cannot hold, and where a platform convention differs from
 * the web on purpose.
 */
export const T = {
  title: '@cosimosi/ui — native',
  subtitle:
    'The same language on React Native: one token source, the primitive siblings, and the chrome they compose. Read beside the web /design to score parity.',
  back: 'Back',

  foundationsTitle: 'Foundations',
  themeLabel: 'Theme roles',
  themeNote:
    'The same role map the web reads, resolved for React Native from the one OKLCH source — never a parallel hex table.',
  typeLabel: 'Typography',
  typeSpecimen: 'The universe remembers what you return to.',
  spacingLabel: 'Spacing',
  radiusLabel: 'Radius',

  universeTitle: 'Universe',
  skyLabel: 'Emotion skies',
  skyNote:
    'The one shared TSL source on the native WebGPU canvas: the enclosing sky sphere, every recipe, and the way each divides itself among the feelings it is handed — inspected on real hardware, which is the only place the frame budget is real.',
  skyCountLabel: 'How many emotions',
  starFormsLabel: 'Star forms',
  starFormsNote:
    'Every candidate body a memory star can wear, drawn through the shipped channel path at one strength so only the form differs. The same row the web group shows — a difference between the two is a parity finding.',
  ambientLabel: 'Neuron, synapse, latent dust',
  ambientNote:
    'The three bodies that carry no feeling. A neuron is a membrane and holds still; a synapse is a cord whose shimmer runs inward from both ends; the dust breathes on its own phase and pools where it clumps.',
  nebulaLabel: 'Emotion colour field',
  nebulaNote:
    'The colour field at the mobile tessellation — the specimen to watch on a device, since its two-octave cloud is the only place this language spends real fragment budget.',
  forgettingLabel: 'Forgetting',
  forgettingNote:
    'One memory at five lengths of absence. It loses light and it loses movement — never size, which is strength, and never hue, which is the feeling. Watch it for a few seconds.',
  forgettingToday: 'today',
  gistLabel: 'Gist risen',
  gistNote:
    'One memory twice: remembered on the left, risen on the right, its gist bodies above their own original. Height is the whole statement — the original is not dimmed, because dimming belongs to forgetting.',
  awakenLabel: 'Awakening',
  awakenNote:
    'A grey mote is replaced by a white-gold flare that grows and hands off to the real neuron, carrying no emotion colour. Each press wakes a new one; whether its 1.1 seconds reads on a phone is what this specimen is here to answer.',
  awakenReplay: 'Wake a neuron',

  primitivesTitle: 'Primitives',
  buttonLabel: 'Button',
  iconButtonLabel: 'Icon button',
  badgeLabel: 'Badge',
  alertLabel: 'Inline alert',
  fieldLabel: 'Fields',
  toggleLabel: 'Toggles',
  overlayLabel: 'Overlays',
  feedbackLabel: 'Feedback',
  touchStatesNote:
    'A touch surface has no hover and no keyboard focus, so those two states are the web catalogue’s to hold. What must read here: resting, pressed, disabled, and busy.',

  patternsTitle: 'Patterns',
  writingLabel: 'Writing flow',
  writingHeading: 'Write a diary',
  writingBodyLabel: 'Today',
  writingDate: 'Today',
  writingBody:
    'The rain stopped sometime in the afternoon and I did not notice until the light changed. I read the same page four times and kept none of it.',
  writingSplit: 'Split into stars',
  writingProposed: 'Proposed stars',
  writingLaunch: 'Send up the stars',
  writingBack: 'Back to writing',

  detailLabel: 'Star detail',
  detailName: 'Winter sea',
  detailDay: 'Y1 · D18',
  detailBody: 'The water was the colour of old coins. We did not say much on the way back.',
  detailStrength: 'Strength',
  detailRecalled: 'Recalled 3× · last Y1 · D24',
  detailRecall: 'Recall',
  detailHistory: 'History',
  detailSource: 'Open the diary',

  hudLabel: 'HUD',
  hudTime: 'Universe time · Y1 · D28',
  hudBalance: 'Twinkle · 42',
  hudWrite: 'Write',

  listLabel: 'List page',
  listHeading: 'Diary',
  listMemories: 'memories',

  statesLabel: 'Empty · loading · error',
  stateEmpty: 'empty',
  stateLoading: 'loading',
  stateError: 'error',
  stateDefault: 'default',
  statePressed: 'pressed',
  stateDisabled: 'disabled',
  emptyHeading: 'No stars yet',
  emptyBody: 'The first diary you write becomes the first light in this universe.',
  emptyAction: 'Write the first one',
  loadingHeading: 'Loading the universe',
  errorHeading: 'The universe did not load',
  errorBody: 'The connection dropped before the stars arrived.',
  errorAction: 'Try again',

  alertDanger: 'The stars did not rise. Nothing was saved — try again.',
  alertWarning:
    'This date is ahead of your universe’s present, so it is kept as a diary without lighting a star.',
  alertInfo: 'The universe advanced while you were writing.',
  alertSuccess: 'Your stars are up.',

  fieldEmail: 'Email',
  fieldEmailPlaceholder: 'you@example.com',
  fieldEmailHint: 'Work address',
  fieldEmailError: 'Enter a valid email',
  fieldNote: 'Note',
  fieldNotePlaceholder: 'Write something…',
  selectLabel: 'Bounded choice',
  selectHint:
    "The trigger wears the same well; the list is ours, so it borrows the dialog's manners.",
  selectError: 'Pick one to continue',
  selectFirst: 'First option',
  selectSecond: 'Second option',
  selectThird: 'Third option',
  switchLabel: 'Wi-Fi',
  checkboxLabel: 'Remember this choice',
  tooltipTrigger: 'Press and hold',
  tooltipContent: 'A tooltip explains; it never carries the only copy of something.',
  toastTrigger: 'Show toast',
  toastBody: 'Saved.',
  dialogTrigger: 'Open dialog',
  dialogTitle: 'Release this star?',
  dialogBody:
    'The memory fades from the universe and the diary keeps its text. This cannot be undone.',
  dialogClose: 'Close',
  dialogCancel: 'Cancel',
  dialogConfirm: 'Release',
} as const
