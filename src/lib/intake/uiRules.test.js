import { describe, expect, it } from 'vitest'
import { parseIntent, selectUIForIntent } from './uiRules.js'

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
