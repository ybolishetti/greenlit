import { describe, expect, it } from 'vitest'
import { crossCheckIntent, enrichQuestionWithUI, parseIntent, selectUIForIntent } from './uiRules.js'

describe('parseIntent', () => {
  it('returns the bare intent with no customProbe when there is no colon', () => {
    expect(parseIntent('visible_damage')).toEqual({ intent: 'visible_damage', customProbe: null })
  })

  it('splits an intent:probe string into base intent and probe', () => {
    expect(parseIntent('visible_damage:need a close-up of the driver-side CV boot')).toEqual({
      intent: 'visible_damage',
      customProbe: 'need a close-up of the driver-side CV boot',
    })
  })

  it('splits only on the first colon, keeping later colons in the probe', () => {
    expect(parseIntent('symptom_timing:only around 3:00 in traffic')).toEqual({
      intent: 'symptom_timing',
      customProbe: 'only around 3:00 in traffic',
    })
  })

  it('trims whitespace around both the intent and the probe', () => {
    expect(parseIntent('  visible_damage :  some probe  ')).toEqual({
      intent: 'visible_damage',
      customProbe: 'some probe',
    })
  })

  it('falls back to freeform_description for an empty string', () => {
    expect(parseIntent('')).toEqual({ intent: 'freeform_description', customProbe: null })
  })

  it('falls back to freeform_description for null/undefined', () => {
    expect(parseIntent(null)).toEqual({ intent: 'freeform_description', customProbe: null })
    expect(parseIntent(undefined)).toEqual({ intent: 'freeform_description', customProbe: null })
  })

  it('falls back to freeform_description when the base intent is empty (leading colon)', () => {
    expect(parseIntent(':some probe')).toEqual({ intent: 'freeform_description', customProbe: null })
  })

  it('returns a null customProbe when the text after the colon is empty', () => {
    expect(parseIntent('visible_damage:')).toEqual({ intent: 'visible_damage', customProbe: null })
  })
})

describe('selectUIForIntent suffix tolerance', () => {
  it('resolves UI from the base intent even when a probe suffix is present', () => {
    expect(selectUIForIntent('warning_lights:check for airbag or SRS')).toEqual(
      selectUIForIntent('warning_lights')
    )
  })
})

describe('fluid_check / fluid_level split', () => {
  it('fluid_check is a multi_select of fluid types, with no level/amount option', () => {
    const ui = selectUIForIntent('fluid_check')
    expect(ui.type).toBe('multi_select')
    expect(ui.options.map((o) => o.value)).not.toContain('low')
  })

  it('fluid_level is a distinct single_select for level/amount, not fluid type', () => {
    const ui = selectUIForIntent('fluid_level')
    expect(ui.type).toBe('single_select')
    expect(ui.options.map((o) => o.value)).toEqual(
      expect.arrayContaining(['normal', 'low', 'very-low', 'not-checked'])
    )
  })
})

describe('symptom_intensity', () => {
  it('is a slider, distinct from the type-based smell_description checklist', () => {
    const ui = selectUIForIntent('symptom_intensity')
    expect(ui.type).toBe('slider')
    expect(ui.lowLabel).toMatch(/faint/i)
    expect(ui.highLabel).toMatch(/strong/i)
  })
})

describe('symptom_onset_delay', () => {
  it('is a single_select of immediate-vs-delayed options, distinct from symptom_timing\'s driving-maneuver options', () => {
    const ui = selectUIForIntent('symptom_onset_delay')
    expect(ui.type).toBe('single_select')
    expect(ui.options.map((o) => o.value)).toEqual(
      expect.arrayContaining(['immediate', 'brief-delay', 'extended-delay', 'inconsistent'])
    )
    expect(ui.options.map((o) => o.value)).not.toContain('braking')
  })
})

describe('crossCheckIntent', () => {
  it('remaps a plain timing-phrased prompt wrongly tagged with a checklist intent to symptom_timing', () => {
    expect(crossCheckIntent('When do you notice the vibration — only on the highway?', 'smell_description')).toBe(
      'symptom_timing'
    )
  })

  it('remaps an onset-delay prompt to symptom_onset_delay even when already tagged symptom_timing (options do not fit)', () => {
    expect(
      crossCheckIntent(
        "When do you notice the sweet smell most — when you first turn on the heater, all the time it's running, or only after the car has been running for a while?",
        'symptom_timing'
      )
    ).toBe('symptom_onset_delay')
  })

  it('remaps an onset-delay prompt tagged with a checklist intent to symptom_onset_delay, not symptom_timing', () => {
    expect(
      crossCheckIntent(
        'When do you first notice the sweet smell — as soon as you turn on the heat, or does it take a minute or two to appear?',
        'smell_description'
      )
    ).toBe('symptom_onset_delay')
  })

  it('remaps an intensity-phrased prompt wrongly tagged with the smell checklist to symptom_intensity', () => {
    expect(
      crossCheckIntent('How strong is the sweet smell — faint and barely noticeable, moderate, or very strong?', 'smell_description')
    ).toBe('symptom_intensity')
  })

  it('leaves a correctly-tagged smell-type question alone', () => {
    expect(crossCheckIntent('What does the smell coming from the vents smell like?', 'smell_description')).toBe(
      'smell_description'
    )
  })

  it('leaves already-plausible intents alone even if they mention "when"', () => {
    expect(crossCheckIntent('Since when have you noticed this?', 'symptom_duration')).toBe('symptom_duration')
  })
})

describe('enrichQuestionWithUI cross-check integration', () => {
  it('corrects the intent and attaches the matching UI when prompt and intent disagree', () => {
    const enriched = enrichQuestionWithUI({
      id: 'q1',
      prompt: 'How strong is the sweet smell — faint, moderate, or very strong?',
      question_intent: 'smell_description',
      rationale: 'test',
    })
    expect(enriched.question_intent).toBe('symptom_intensity')
    expect(enriched.ui.type).toBe('slider')
  })
})
