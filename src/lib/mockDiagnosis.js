// Rules-based mock diagnosis engine.
// Stands in for the real multimodal model described in the Greenlit business
// plan (audio + photo + feel + guided questions -> mechanic brief). This is
// intentionally simple and deterministic so the demo behaves predictably.

const RULES = {
  brakes: {
    squeal: {
      causes: [
        { cause: 'Worn brake pads (wear indicator contact)', confidence: 0.8 },
        { cause: 'Glazed or contaminated rotor surface', confidence: 0.12 },
        { cause: 'Caliper hardware slightly loose', confidence: 0.08 },
      ],
      components: ['Front & rear brake pads', 'Rotor surface', 'Caliper hardware'],
      estimate: [150, 380],
      baseUrgency: 'monitor',
    },
    grinding: {
      causes: [
        { cause: 'Brake pads worn to backing plate', confidence: 0.7 },
        { cause: 'Damaged or scored rotor', confidence: 0.25 },
        { cause: 'Debris lodged between pad and rotor', confidence: 0.05 },
      ],
      components: ['Brake pads', 'Rotors', 'Calipers'],
      estimate: [250, 600],
      baseUrgency: 'immediate',
    },
    soft: {
      causes: [
        { cause: 'Air in brake lines', confidence: 0.45 },
        { cause: 'Brake fluid leak', confidence: 0.35 },
        { cause: 'Worn master cylinder', confidence: 0.2 },
      ],
      components: ['Brake lines', 'Master cylinder', 'Fluid reservoir'],
      estimate: [120, 500],
      baseUrgency: 'immediate',
    },
  },
  engine: {
    knock: {
      causes: [
        { cause: 'Low oil pressure / hydraulic lifter noise', confidence: 0.55 },
        { cause: 'Rod bearing wear', confidence: 0.28 },
        { cause: 'Loose heat shield resonating at engine speed', confidence: 0.17 },
      ],
      components: ['Oil level & pressure', 'Lifters / valvetrain', 'Heat shields'],
      estimate: [120, 1200],
      baseUrgency: 'monitor',
    },
    rattle: {
      causes: [
        { cause: 'Loose exhaust heat shield', confidence: 0.62 },
        { cause: 'Worn accessory belt or tensioner', confidence: 0.23 },
        { cause: 'Loose engine cover / splash shield', confidence: 0.15 },
      ],
      components: ['Heat shields', 'Belt & tensioner', 'Under-engine covers'],
      estimate: [60, 300],
      baseUrgency: 'routine',
    },
    stall: {
      causes: [
        { cause: 'Failing idle air control valve', confidence: 0.4 },
        { cause: 'Dirty throttle body', confidence: 0.35 },
        { cause: 'Fuel delivery issue (pump / filter)', confidence: 0.25 },
      ],
      components: ['Idle control system', 'Throttle body', 'Fuel system'],
      estimate: [150, 700],
      baseUrgency: 'immediate',
    },
  },
  steering: {
    vibration: {
      causes: [
        { cause: 'Wheel/tire imbalance', confidence: 0.5 },
        { cause: 'Alignment out of spec', confidence: 0.3 },
        { cause: 'Worn CV axle', confidence: 0.2 },
      ],
      components: ['Wheel balance', 'Alignment', 'CV axles'],
      estimate: [80, 450],
      baseUrgency: 'routine',
    },
    stiff: {
      causes: [
        { cause: 'Low power steering fluid', confidence: 0.48 },
        { cause: 'Failing power steering pump', confidence: 0.32 },
        { cause: 'Worn rack and pinion', confidence: 0.2 },
      ],
      components: ['Power steering fluid & lines', 'Steering pump', 'Rack and pinion'],
      estimate: [60, 900],
      baseUrgency: 'monitor',
    },
    pull: {
      causes: [
        { cause: 'Alignment pulling to one side', confidence: 0.55 },
        { cause: 'Uneven tire pressure or wear', confidence: 0.3 },
        { cause: 'Sticking brake caliper', confidence: 0.15 },
      ],
      components: ['Alignment', 'Tire pressure & wear', 'Brake calipers'],
      estimate: [70, 350],
      baseUrgency: 'monitor',
    },
  },
  suspension: {
    clunk: {
      causes: [
        { cause: 'Worn sway bar end links', confidence: 0.45 },
        { cause: 'Worn strut mounts', confidence: 0.35 },
        { cause: 'Loose control arm bushings', confidence: 0.2 },
      ],
      components: ['Sway bar links', 'Strut mounts', 'Control arm bushings'],
      estimate: [90, 500],
      baseUrgency: 'routine',
    },
    bounce: {
      causes: [
        { cause: 'Worn shocks or struts', confidence: 0.65 },
        { cause: 'Failing spring', confidence: 0.2 },
        { cause: 'Worn bushings', confidence: 0.15 },
      ],
      components: ['Shocks / struts', 'Springs', 'Bushings'],
      estimate: [200, 900],
      baseUrgency: 'monitor',
    },
  },
  exhaust: {
    rattle: {
      causes: [
        { cause: 'Loose heat shield', confidence: 0.55 },
        { cause: 'Failing muffler hanger', confidence: 0.28 },
        { cause: 'Exhaust leak at joint', confidence: 0.17 },
      ],
      components: ['Heat shields', 'Muffler hangers', 'Exhaust joints'],
      estimate: [50, 350],
      baseUrgency: 'routine',
    },
    loud: {
      causes: [
        { cause: 'Exhaust leak or hole', confidence: 0.5 },
        { cause: 'Failing muffler', confidence: 0.35 },
        { cause: 'Disconnected exhaust section', confidence: 0.15 },
      ],
      components: ['Exhaust piping', 'Muffler', 'Gaskets & clamps'],
      estimate: [100, 600],
      baseUrgency: 'routine',
    },
  },
  electrical: {
    intermittent: {
      causes: [
        { cause: 'Weak or failing battery', confidence: 0.4 },
        { cause: 'Alternator undercharging', confidence: 0.32 },
        { cause: 'Corroded or loose wiring connection', confidence: 0.28 },
      ],
      components: ['Battery & terminals', 'Alternator output', 'Ground connections'],
      estimate: [40, 500],
      baseUrgency: 'monitor',
    },
    warninglight: {
      causes: [
        { cause: 'Sensor fault triggering code', confidence: 0.5 },
        { cause: 'Loose gas cap or evap system leak', confidence: 0.25 },
        { cause: 'Wiring or connector issue', confidence: 0.25 },
      ],
      components: ['OBD2 code scan', 'Related sensor', 'Wiring harness'],
      estimate: [0, 300],
      baseUrgency: 'routine',
    },
  },
  other: {
    unsure: {
      causes: [
        { cause: 'General inspection needed to isolate symptom', confidence: 1 },
      ],
      components: ['Full multi-point inspection'],
      estimate: [0, 150],
      baseUrgency: 'routine',
    },
  },
}

const URGENCY_LABEL = {
  immediate: 'Immediate safety risk',
  monitor: 'Monitor closely',
  routine: 'Routine service',
}

const CATEGORY_LABEL = {
  brakes: 'Brakes',
  engine: 'Engine / under the hood',
  steering: 'Steering wheel',
  suspension: 'Suspension / ride',
  exhaust: 'Exhaust / underneath',
  electrical: 'Electrical / dashboard',
  other: 'Not sure',
}

function bump(urgency, intake) {
  // Escalate urgency if the driver reported a relevant warning light or the
  // issue has been happening for a long time without attention.
  const order = ['routine', 'monitor', 'immediate']
  let idx = order.indexOf(urgency)
  if (intake.warningLight && intake.warningLight !== 'none') idx = Math.min(idx + 1, 2)
  if (intake.duration === 'months' && idx < 1) idx = 1
  return order[idx]
}

export function generateBrief(intake) {
  const categoryRules = RULES[intake.category] || RULES.other
  const descriptorRules =
    categoryRules[intake.descriptor] || Object.values(categoryRules)[0]

  const urgencyKey = bump(descriptorRules.baseUrgency, intake)

  const symptomLanguageParts = []
  if (intake.notes) symptomLanguageParts.push(`"${intake.notes.trim()}"`)
  if (intake.timing) symptomLanguageParts.push(`Occurs while ${TIMING_LABEL[intake.timing] || intake.timing}`)
  if (intake.duration) symptomLanguageParts.push(`Started: ${DURATION_LABEL[intake.duration] || intake.duration}`)

  return {
    category: CATEGORY_LABEL[intake.category] || intake.category,
    urgency: urgencyKey,
    urgencyLabel: URGENCY_LABEL[urgencyKey],
    probableCauses: descriptorRules.causes.map((c) => ({
      cause: c.cause,
      confidence: Math.round(c.confidence * 100),
    })),
    componentsToInspect: descriptorRules.components,
    estimateRange: descriptorRules.estimate,
    symptomLanguage: symptomLanguageParts,
    feel: intake.feel,
    inputs: {
      audio: !!intake.hasAudio,
      photo: !!intake.hasPhoto,
    },
  }
}

export const TIMING_LABEL = {
  starting: 'starting the car',
  braking: 'braking',
  turning: 'turning',
  accelerating: 'accelerating',
  highway: 'highway speed',
  bumps: 'going over bumps',
  always: 'all the time',
}

export const DURATION_LABEL = {
  'just-started': 'Just started, today',
  'few-days': 'A few days ago',
  weeks: 'A few weeks ago',
  months: 'Months ago',
}

export const CATEGORY_OPTIONS = [
  { value: 'engine', label: 'Engine / under the hood' },
  { value: 'brakes', label: 'Brakes' },
  { value: 'steering', label: 'Steering wheel' },
  { value: 'suspension', label: 'Suspension / ride' },
  { value: 'exhaust', label: 'Exhaust / underneath' },
  { value: 'electrical', label: 'Electrical / dashboard' },
  { value: 'other', label: "Not sure" },
]

export const DESCRIPTOR_OPTIONS = {
  brakes: [
    { value: 'squeal', label: 'High-pitched squeal' },
    { value: 'grinding', label: 'Grinding / metal-on-metal' },
    { value: 'soft', label: 'Pedal feels soft or sinks' },
  ],
  engine: [
    { value: 'knock', label: 'Knocking or tapping' },
    { value: 'rattle', label: 'Rattling' },
    { value: 'stall', label: 'Stalling or rough idle' },
  ],
  steering: [
    { value: 'vibration', label: 'Vibration in the wheel' },
    { value: 'stiff', label: 'Feels stiff / hard to turn' },
    { value: 'pull', label: 'Car pulls to one side' },
  ],
  suspension: [
    { value: 'clunk', label: 'Clunk over bumps' },
    { value: 'bounce', label: 'Bouncy / floaty ride' },
  ],
  exhaust: [
    { value: 'rattle', label: 'Rattling underneath' },
    { value: 'loud', label: 'Noticeably louder than usual' },
  ],
  electrical: [
    { value: 'intermittent', label: 'Things cutting in and out' },
    { value: 'warninglight', label: 'A warning light turned on' },
  ],
  other: [{ value: 'unsure', label: "I'm not sure how to describe it" }],
}

export const TIMING_OPTIONS = [
  { value: 'starting', label: 'Starting the car' },
  { value: 'braking', label: 'Braking' },
  { value: 'turning', label: 'Turning' },
  { value: 'accelerating', label: 'Accelerating' },
  { value: 'highway', label: 'At highway speed' },
  { value: 'bumps', label: 'Going over bumps' },
  { value: 'always', label: 'All the time' },
]

export const DURATION_OPTIONS = [
  { value: 'just-started', label: 'Just started, today' },
  { value: 'few-days', label: 'A few days' },
  { value: 'weeks', label: 'A few weeks' },
  { value: 'months', label: 'Months' },
]

export const WARNING_LIGHT_OPTIONS = [
  { value: 'check-engine', label: 'Check engine light' },
  { value: 'battery', label: 'Battery light' },
  { value: 'oil', label: 'Check oil light' },
  { value: 'abs', label: 'ABS / brake light' },
  { value: 'tire-pressure', label: 'Tire pressure light (TPMS)' },
  { value: 'none', label: 'No warning lights' },
  { value: 'other', label: 'Some other light' },
]
