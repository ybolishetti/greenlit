import { generateBrief } from '../mockDiagnosis.js'
import { FinalBriefSchema } from './schemas.js'

const ROUND1 = {
  type: 'question_batch',
  round: 1,
  questions: [
    {
      id: 'q_stub_1',
      prompt: 'Where do you notice the problem?',
      ui: {
        type: 'single_select',
        options: [
          { value: 'brakes', label: 'Brakes' },
          { value: 'engine', label: 'Engine / under the hood' },
          { value: 'steering', label: 'Steering wheel' },
          { value: 'suspension', label: 'Suspension / ride' },
          { value: 'other', label: 'Not sure' },
        ],
      },
      rationale: 'Locate the symptom area.',
    },
    {
      id: 'q_stub_2',
      prompt: 'When does it happen?',
      ui: {
        type: 'single_select',
        options: [
          { value: 'braking', label: 'Braking' },
          { value: 'turning', label: 'Turning' },
          { value: 'accelerating', label: 'Accelerating' },
          { value: 'always', label: 'All the time' },
        ],
      },
      rationale: 'Timing narrows causes.',
    },
    {
      id: 'q_stub_3',
      prompt: 'How long has this been going on?',
      ui: {
        type: 'single_select',
        options: [
          { value: 'just-started', label: 'Just started' },
          { value: 'few-days', label: 'A few days' },
          { value: 'weeks', label: 'A few weeks' },
          { value: 'months', label: 'Months' },
        ],
      },
      rationale: 'Duration affects urgency.',
    },
  ],
}

const ROUND2 = {
  type: 'question_batch',
  round: 2,
  questions: [
    {
      id: 'q_stub_4',
      prompt: 'Describe the sound or feeling in your own words.',
      ui: { type: 'natural_language', placeholder: 'e.g. high pitched squeal when I brake' },
      rationale: 'Exact customer language for the brief.',
    },
    {
      id: 'q_stub_5',
      prompt: 'Any warning lights on the dashboard?',
      ui: {
        type: 'single_select',
        options: [
          { value: 'none', label: 'No warning lights' },
          { value: 'check-engine', label: 'Check engine light' },
          { value: 'abs', label: 'ABS / brake light' },
          { value: 'other', label: 'Some other light' },
        ],
      },
      rationale: 'Warning lights escalate urgency.',
    },
  ],
}

function answerMap(messages) {
  const map = {}
  for (const m of messages) {
    if (m.role === 'user' && m.content?.type === 'answer') {
      map[m.content.answer_to] = m.content
    }
  }
  return map
}

function collectText(messages, media) {
  const textMedia = media?.find((m) => m.kind === 'text')
  if (textMedia?.text_content) return textMedia.text_content
  for (const m of messages) {
    if (m.role === 'user' && m.content?.type === 'answer' && typeof m.content.value === 'string') {
      if (m.content.value.length > 10) return m.content.value
    }
    if (m.content?.free_text) return m.content.free_text
  }
  return ''
}

function mapToMockIntake(messages, media) {
  const answers = answerMap(messages)
  const category = answers.q_stub_1?.value || 'brakes'
  const timing = answers.q_stub_2?.value || 'braking'
  const duration = answers.q_stub_3?.value || 'weeks'
  const warningLight = answers.q_stub_5?.value || 'none'
  const notes = answers.q_stub_4?.value || collectText(messages, media)

  const descriptorByCategory = {
    brakes: 'squeal',
    engine: 'knock',
    steering: 'vibration',
    suspension: 'clunk',
    other: 'unsure',
  }

  const lower = String(notes).toLowerCase()
  let descriptor = descriptorByCategory[category] || 'unsure'
  if (lower.includes('grind')) descriptor = 'grinding'
  else if (lower.includes('soft') || lower.includes('sink')) descriptor = 'soft'
  else if (lower.includes('knock')) descriptor = 'knock'
  else if (lower.includes('rattle')) descriptor = 'rattle'
  else if (lower.includes('vibrat')) descriptor = 'vibration'

  return {
    category,
    descriptor,
    timing,
    duration,
    warningLight,
    notes,
    feel: { pedal: 5, steering: 2, vibration: 3 },
    hasAudio: media?.some((m) => m.kind === 'audio') ?? false,
    hasPhoto: media?.some((m) => m.kind === 'photo' || m.kind === 'video') ?? false,
  }
}

function mockToFinalBrief(mockIntake, media) {
  const brief = generateBrief(mockIntake)
  const final = {
    type: 'final',
    category: brief.category,
    urgency: brief.urgency,
    urgencyLabel: brief.urgencyLabel,
    probableCauses: brief.probableCauses,
    componentsToInspect: brief.componentsToInspect,
    estimateRange: brief.estimateRange,
    symptomLanguage: brief.symptomLanguage.length
      ? brief.symptomLanguage
      : mockIntake.notes
        ? [`"${mockIntake.notes.trim()}"`]
        : ['No additional description provided.'],
    disclaimer:
      'This brief is a triage aid based on the customer\'s self-reported symptoms. It is not a diagnosis. A qualified mechanic must inspect the vehicle before any repair is performed.',
    inputs: {
      audio: media?.some((m) => m.kind === 'audio') ?? false,
      photo: media?.some((m) => m.kind === 'photo') ?? false,
      video: media?.some((m) => m.kind === 'video') ?? false,
      text: media?.some((m) => m.kind === 'text') ?? false,
    },
  }
  return FinalBriefSchema.parse(final)
}

export function isStubMode() {
  if (import.meta.env.VITE_LLM_STUB_MODE === 'true') return true
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) return true
  return false
}

export async function stubInterviewer(payload) {
  const { conversation = [], force_done: forceDone } = payload
  if (forceDone) return { type: 'done' }

  const batches = conversation.filter(
    (m) => m.role === 'interviewer' && m.content?.type === 'question_batch'
  ).length

  if (batches === 0) return ROUND1
  if (batches === 1) return ROUND2
  return { type: 'done' }
}

export async function stubDiagnosticianHypothesis(payload) {
  const round = payload.round ?? 1
  if (round === 1) {
    return {
      type: 'hypothesis',
      round: 1,
      confidence: 0.52,
      needs_more_info: [
        'Exact sound or feeling in the customer\'s own words',
        'Whether any dashboard warning lights are on',
      ],
      top_causes: [
        { cause: 'Worn brake pads (wear indicator contact)', confidence: 0.35 },
        { cause: 'Glazed rotor surface', confidence: 0.12 },
      ],
    }
  }
  return {
    type: 'hypothesis',
    round: 2,
    confidence: 0.78,
    needs_more_info: [],
    top_causes: [{ cause: 'Worn brake pads (wear indicator contact)', confidence: 0.72 }],
  }
}

export async function stubDiagnosticianFinal(payload) {
  const mockIntake = mapToMockIntake(payload.conversation ?? [], payload.media_summary)
  return mockToFinalBrief(mockIntake, payload.media_summary)
}
