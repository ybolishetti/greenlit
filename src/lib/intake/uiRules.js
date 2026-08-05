/**
 * Deterministic UI selection — maps question_intent → UI component definition.
 * Single source of truth; the Interviewer LLM never picks UI types.
 */

export const QUESTION_INTENTS = [
  'symptom_timing',
  'symptom_location',
  'symptom_duration',
  'symptom_frequency',
  'pedal_feel',
  'steering_feel',
  'vibration_intensity',
  'vibration_location',
  'warning_lights',
  'visible_damage',
  'sound_capture',
  'motion_capture',
  'safety_confirmation',
  'freeform_description',
  // Added for the Anthropic-powered diagnosis engine (2026-08-03)
  'smell_description',
  'driving_conditions',
  'recent_repairs',
  'fluid_check',
  // Split from fluid_check (2026-08-04): fluid_check is type/color identification
  // only; fluid_level is the separate "is it low/dropping" question.
  'fluid_level',
  // Added 2026-08-04: closes a real coverage gap — "how strong/faint is this
  // smell/sound/symptom" had no slider intent to land on, so the model was
  // reaching for a checklist intent (e.g. smell_description) whose fixed
  // options describe *type*, not *intensity*, producing prompt/answer mismatches.
  'symptom_intensity',
]

const TIMING_OPTIONS = [
  { value: 'cold-start', label: 'Cold start / first drive of the day' },
  { value: 'highway', label: 'Highway speed' },
  { value: 'braking', label: 'Braking' },
  { value: 'turning', label: 'Turning' },
  { value: 'accelerating', label: 'Accelerating' },
  { value: 'always', label: 'All the time' },
]

const LOCATION_OPTIONS = [
  { value: 'front-left', label: 'Front left' },
  { value: 'front-right', label: 'Front right' },
  { value: 'rear', label: 'Rear' },
  { value: 'under-hood', label: 'Under the hood' },
  { value: 'inside-cabin', label: 'Inside the cabin' },
  { value: 'not-sure', label: 'Not sure' },
]

const DURATION_OPTIONS = [
  { value: 'today', label: 'Started today' },
  { value: 'week', label: 'About a week' },
  { value: 'month', label: 'About a month' },
  { value: 'longer', label: 'Longer than a month' },
]

const FREQUENCY_OPTIONS = [
  { value: 'always', label: 'Every time I drive' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'only-when', label: 'Only under specific conditions' },
  { value: 'once', label: 'Happened once or twice' },
]

const VIBRATION_LOCATION_OPTIONS = [
  { value: 'steering-wheel', label: 'Steering wheel' },
  { value: 'seat', label: 'Driver seat' },
  { value: 'pedals', label: 'Pedals' },
  { value: 'whole-car', label: 'Whole car' },
]

const WARNING_LIGHT_OPTIONS = [
  { value: 'check-engine', label: 'Check engine' },
  { value: 'abs', label: 'ABS / brake' },
  { value: 'oil', label: 'Check oil' },
  { value: 'battery', label: 'Battery' },
  { value: 'tire-pressure', label: 'Tire pressure (TPMS)' },
  { value: 'none', label: 'No warning lights' },
  { value: 'other', label: 'Other warning light' },
]

const SMELL_OPTIONS = [
  { value: 'burning-rubber', label: 'Burning rubber' },
  { value: 'sweet-syrup', label: 'Sweet / syrupy (coolant)' },
  { value: 'rotten-egg', label: 'Rotten eggs (exhaust / catalytic)' },
  { value: 'burning-oil', label: 'Burning oil' },
  { value: 'gas-fuel', label: 'Raw gas / fuel' },
  { value: 'electrical-burning', label: 'Burning plastic / electrical' },
  { value: 'none', label: 'No unusual smell' },
]

const DRIVING_CONDITIONS_OPTIONS = [
  { value: 'cold-start', label: 'Cold start / first drive of the day' },
  { value: 'city-stop-go', label: 'City / stop-and-go' },
  { value: 'highway', label: 'Highway / sustained speed' },
  { value: 'uphill-load', label: 'Uphill or towing / loaded' },
  { value: 'rough-roads', label: 'Rough or bumpy roads' },
  { value: 'after-warmup', label: 'Only once warmed up' },
]

const RECENT_REPAIRS_OPTIONS = [
  { value: 'brakes', label: 'Brakes' },
  { value: 'tires-wheels', label: 'Tires / wheels' },
  { value: 'battery-electrical', label: 'Battery / electrical' },
  { value: 'oil-fluids', label: 'Oil / fluid change' },
  { value: 'suspension-steering', label: 'Suspension / steering' },
  { value: 'engine-work', label: 'Engine work' },
  { value: 'other', label: 'Other' },
  { value: 'none', label: 'No recent work' },
]

const FLUID_CHECK_OPTIONS = [
  { value: 'oil', label: 'Oil (brown / black)' },
  { value: 'coolant', label: 'Coolant (green / orange / pink)' },
  { value: 'transmission', label: 'Transmission (red)' },
  { value: 'power-steering', label: 'Power steering' },
  { value: 'brake-fluid', label: 'Brake fluid' },
  { value: 'unknown-puddle', label: 'Puddle, unsure what' },
  { value: 'none', label: "No leaks / haven't noticed" },
]

const FLUID_LEVEL_OPTIONS = [
  { value: 'normal', label: "Normal — hasn't needed topping off" },
  { value: 'low', label: 'Low — needs topping off more than usual' },
  { value: 'very-low', label: 'Very low or empty' },
  { value: 'not-checked', label: "Haven't checked" },
]

const INTENT_UI_MAP = {
  symptom_timing: {
    type: 'single_select',
    options: TIMING_OPTIONS,
  },
  symptom_location: {
    type: 'single_select',
    options: LOCATION_OPTIONS,
  },
  symptom_duration: {
    type: 'single_select',
    options: DURATION_OPTIONS,
  },
  symptom_frequency: {
    type: 'single_select',
    options: FREQUENCY_OPTIONS,
  },
  pedal_feel: {
    type: 'slider',
    min: 0,
    max: 10,
    step: 1,
    lowLabel: 'Loose / soft',
    highLabel: 'Stiff / hard',
  },
  steering_feel: {
    type: 'slider',
    min: 0,
    max: 10,
    step: 1,
    lowLabel: 'Easy / light',
    highLabel: 'Heavy / resistant',
  },
  vibration_intensity: {
    type: 'slider',
    min: 0,
    max: 10,
    step: 1,
    lowLabel: 'None',
    highLabel: 'Severe',
  },
  vibration_location: {
    type: 'single_select',
    options: VIBRATION_LOCATION_OPTIONS,
  },
  warning_lights: {
    type: 'multi_select',
    options: WARNING_LIGHT_OPTIONS,
    mutexValue: 'none',
  },
  visible_damage: {
    type: 'media_request',
    kind: 'photo',
    prompt: 'Take a photo of the visible damage or leak',
  },
  sound_capture: {
    type: 'media_request',
    kind: 'audio',
    prompt: 'Record the sound while it happens (10–15 seconds)',
  },
  motion_capture: {
    type: 'media_request',
    kind: 'video',
    prompt: 'Record a short video showing the problem',
  },
  safety_confirmation: {
    type: 'toggle',
    trueLabel: 'Yes, it feels safe to drive',
    falseLabel: 'No, I would not drive it',
  },
  smell_description: {
    type: 'multi_select',
    options: SMELL_OPTIONS,
    mutexValue: 'none',
  },
  driving_conditions: {
    type: 'multi_select',
    options: DRIVING_CONDITIONS_OPTIONS,
  },
  recent_repairs: {
    type: 'multi_select',
    options: RECENT_REPAIRS_OPTIONS,
    mutexValue: 'none',
  },
  fluid_check: {
    type: 'multi_select',
    options: FLUID_CHECK_OPTIONS,
    mutexValue: 'none',
  },
  fluid_level: {
    type: 'single_select',
    options: FLUID_LEVEL_OPTIONS,
  },
  freeform_description: {
    type: 'natural_language',
    placeholder: 'Describe what you notice in your own words…',
  },
  symptom_intensity: {
    type: 'slider',
    min: 0,
    max: 10,
    step: 1,
    lowLabel: 'Faint / barely noticeable',
    highLabel: 'Very strong',
  },
}

/**
 * Split a raw question_intent string into its base intent and an optional
 * custom-probe phrasing hint the Diagnostician may have appended.
 *
 * The Diagnostician communicates phrasing hints to the Interviewer via
 * `needs_more_info` entries shaped "<intent>:<probe text>" (e.g.
 * "visible_damage:need a close-up of the driver-side CV boot"). The
 * Interviewer is instructed to echo only the base intent back in its own
 * `question_intent` output, so in normal operation a suffixed value should
 * never reach this function — QuestionIntentSchema validation on the raw
 * LLM output rejects it first. This exists as defense-in-depth for legacy
 * records or a misbehaving model, and splits on the *first* colon only,
 * since the probe text itself may contain colons (e.g. a time like "3:00").
 *
 * @param {string} rawIntent
 * @returns {{ intent: string, customProbe: string | null }}
 */
export function parseIntent(rawIntent) {
  if (typeof rawIntent !== 'string' || rawIntent.trim().length === 0) {
    return { intent: 'freeform_description', customProbe: null }
  }

  const idx = rawIntent.indexOf(':')
  if (idx === -1) {
    return { intent: rawIntent.trim(), customProbe: null }
  }

  const base = rawIntent.slice(0, idx).trim()
  const probe = rawIntent.slice(idx + 1).trim()

  if (base.length === 0) {
    return { intent: 'freeform_description', customProbe: null }
  }

  return { intent: base, customProbe: probe.length ? probe : null }
}

// Defense-in-depth for the Interviewer's own intent/prompt-matching rule
// (see interviewer.md "Match the intent to the actual answer format"): the
// model is instructed to self-check this, but nothing enforces it, so a
// mistagged question ships with a fixed answer set that doesn't fit what
// `prompt` actually asks (e.g. a timing question wired to a smell-type
// checklist). These patterns catch the two clearest, most common failure
// shapes and remap the intent before UI selection — intentionally narrow so
// it only overrides a genuinely wrong pairing, never a plausible one.
const TIMING_SIGNAL = /\bwhen (do|does|did) you\b|\bas soon as\b|\bhow soon\b|\btakes? (a )?(minute|couple|while) to\b|\bright away\b|\bimmediately or\b/i
const INTENSITY_SIGNAL = /\bhow (strong|intense|severe|faint)\b|\bfaint\b(?!.*smell like)|\bbarely noticeable\b|\bvery strong\b|\bmild(,| or)? moderate\b/i

// Intents whose fixed answer set is a closed checklist/scale unrelated to
// *when* something happens — a strong timing-phrased prompt on one of these
// is a mismatch, not a valid choice.
const NOT_TIMING_SHAPED = new Set([
  'smell_description',
  'warning_lights',
  'driving_conditions',
  'recent_repairs',
  'fluid_check',
  'fluid_level',
  'vibration_location',
  'safety_confirmation',
  'pedal_feel',
  'steering_feel',
  'vibration_intensity',
  'visible_damage',
  'sound_capture',
  'motion_capture',
  'symptom_location',
])

// Checklist-type intents describe *category/type*, not *degree* — an
// intensity-phrased prompt on one of these means the model reached for the
// nearest topical checklist instead of the (previously nonexistent, now
// available) intensity slider.
const CHECKLIST_SHAPED = new Set(['smell_description', 'warning_lights', 'driving_conditions', 'recent_repairs', 'fluid_check'])

/**
 * @param {string} prompt
 * @param {string} intent
 * @returns {string}
 */
export function crossCheckIntent(prompt, intent) {
  if (typeof prompt !== 'string' || !prompt) return intent
  if (TIMING_SIGNAL.test(prompt) && NOT_TIMING_SHAPED.has(intent)) return 'symptom_timing'
  if (INTENSITY_SIGNAL.test(prompt) && CHECKLIST_SHAPED.has(intent)) return 'symptom_intensity'
  return intent
}

/**
 * @param {string} intent
 * @returns {import('../ai/schemas.js').UISchema extends infer T ? T : never}
 */
export function selectUIForIntent(intent) {
  const { intent: base } = parseIntent(intent)
  const normalized = QUESTION_INTENTS.includes(base) ? base : 'freeform_description'
  return INTENT_UI_MAP[normalized]
}

/**
 * Attach derived UI to an interviewer question (compatibility: keep legacy q.ui if present).
 * @param {{ id: string, prompt: string, rationale: string, question_intent?: string, ui?: object }} question
 */
export function enrichQuestionWithUI(question) {
  if (question.ui) return question
  const { intent } = parseIntent(question.question_intent ?? 'freeform_description')
  const normalized = QUESTION_INTENTS.includes(intent) ? intent : 'freeform_description'
  const checked = crossCheckIntent(question.prompt, normalized)
  return {
    ...question,
    question_intent: checked,
    ui: selectUIForIntent(checked),
  }
}

/**
 * @param {import('../ai/schemas.js').QuestionBatchSchema extends infer T ? T : never} batch
 */
export function enrichQuestionBatch(batch) {
  if (batch.type !== 'question_batch') return batch
  return {
    ...batch,
    questions: batch.questions.map(enrichQuestionWithUI),
  }
}
