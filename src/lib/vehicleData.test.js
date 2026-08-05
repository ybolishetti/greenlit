import { describe, expect, it } from 'vitest'
import { VEHICLE_MAKES, MAKE_MODELS, isKnownMake, isKnownModel } from './vehicleData.js'

describe('vehicleData', () => {
  it('every make in VEHICLE_MAKES has a model list', () => {
    for (const make of VEHICLE_MAKES) {
      expect(Array.isArray(MAKE_MODELS[make]), `${make} missing models`).toBe(true)
      expect(MAKE_MODELS[make].length).toBeGreaterThan(0)
    }
  })

  it('isKnownMake recognizes listed makes and rejects others', () => {
    expect(isKnownMake('Toyota')).toBe(true)
    expect(isKnownMake('Other')).toBe(false)
    expect(isKnownMake('Delorean')).toBe(false)
    expect(isKnownMake('')).toBe(false)
    expect(isKnownMake(null)).toBe(false)
  })

  it('isKnownModel checks the model belongs to the make', () => {
    expect(isKnownModel('Toyota', 'Camry')).toBe(true)
    expect(isKnownModel('Toyota', 'Civic')).toBe(false)
    expect(isKnownModel('Delorean', 'DMC-12')).toBe(false)
  })
})
