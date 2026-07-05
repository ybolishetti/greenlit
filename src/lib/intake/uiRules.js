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
  { value: 'oil', label: 'Oil pressure' },
  { value: 'battery', label: 'Battery' },
  { value: 'other', label: 'Other warning light' },
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
  freeform_description: {
    type: 'natural_language',
    placeholder: 'Describe what you notice in your own words…',
  },
}

/**
 * @param {string} intent
 * @returns {import('../ai/schemas.js').UISchema extends infer T ? T : never}
 */
export function selectUIForIntent(intent) {
  const normalized = QUESTION_INTENTS.includes(intent) ? intent : 'freeform_description'
  return INTENT_UI_MAP[normalized]
}

/**
 * Attach derived UI to an interviewer question (compatibility: keep legacy q.ui if present).
 * @param {{ id: string, prompt: string, rationale: string, question_intent?: string, ui?: object }} question
 */
export function enrichQuestionWithUI(question) {
  if (question.ui) return question
  const intent = question.question_intent ?? 'freeform_description'
  return {
    ...question,
    question_intent: QUESTION_INTENTS.includes(intent) ? intent : 'freeform_description',
    ui: selectUIForIntent(intent),
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
