/**
 * Curated make → model data for the vehicle intake dropdowns.
 *
 * This is intentionally a common-case list, not an exhaustive VIN database:
 * covering the popular US-market models for the top makes keeps typos out of
 * the ~95% case. Anything not listed is handled by the "Other" free-text
 * fallback in VehicleForm, so an obscure or very new vehicle is never blocked.
 */

export const OTHER = 'Other'

export const VEHICLE_MAKES = [
  'Acura', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge',
  'Ford', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jeep', 'Kia', 'Lexus',
  'Lincoln', 'Mazda', 'Mercedes-Benz', 'Mini', 'Mitsubishi', 'Nissan', 'Ram',
  'Subaru', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo',
]

export const MAKE_MODELS = {
  Acura: ['ILX', 'Integra', 'TLX', 'RLX', 'MDX', 'RDX', 'NSX'],
  Audi: ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron', 'TT'],
  BMW: ['2 Series', '3 Series', '4 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5', 'X7', 'i4', 'iX', 'M3'],
  Buick: ['Enclave', 'Encore', 'Envision', 'LaCrosse', 'Regal'],
  Cadillac: ['ATS', 'CTS', 'CT4', 'CT5', 'Escalade', 'XT4', 'XT5', 'XT6'],
  Chevrolet: ['Silverado', 'Equinox', 'Malibu', 'Tahoe', 'Suburban', 'Traverse', 'Camaro', 'Corvette', 'Colorado', 'Cruze', 'Impala', 'Trax', 'Bolt'],
  Chrysler: ['300', 'Pacifica', 'Voyager'],
  Dodge: ['Charger', 'Challenger', 'Durango', 'Grand Caravan', 'Journey'],
  Ford: ['F-150', 'F-250', 'Escape', 'Explorer', 'Mustang', 'Focus', 'Fusion', 'Edge', 'Expedition', 'Ranger', 'Bronco', 'Maverick'],
  GMC: ['Sierra', 'Terrain', 'Acadia', 'Yukon', 'Canyon'],
  Honda: ['Accord', 'Civic', 'CR-V', 'Pilot', 'Odyssey', 'HR-V', 'Fit', 'Ridgeline', 'Passport'],
  Hyundai: ['Elantra', 'Sonata', 'Tucson', 'Santa Fe', 'Kona', 'Palisade', 'Accent', 'Ioniq'],
  Infiniti: ['Q50', 'Q60', 'QX50', 'QX60', 'QX80'],
  Jeep: ['Wrangler', 'Grand Cherokee', 'Cherokee', 'Compass', 'Renegade', 'Gladiator'],
  Kia: ['Optima', 'Forte', 'Soul', 'Sorento', 'Sportage', 'Telluride', 'Rio', 'Stinger', 'Seltos', 'Carnival'],
  Lexus: ['ES', 'IS', 'RX', 'NX', 'GX', 'LX', 'LS', 'UX'],
  Lincoln: ['Navigator', 'Aviator', 'Corsair', 'Nautilus', 'MKZ', 'MKC'],
  Mazda: ['Mazda3', 'Mazda6', 'CX-3', 'CX-30', 'CX-5', 'CX-9', 'MX-5 Miata'],
  'Mercedes-Benz': ['A-Class', 'C-Class', 'E-Class', 'S-Class', 'CLA', 'GLA', 'GLC', 'GLE', 'GLS'],
  Mini: ['Cooper', 'Countryman', 'Clubman'],
  Mitsubishi: ['Outlander', 'Outlander Sport', 'Eclipse Cross', 'Mirage'],
  Nissan: ['Altima', 'Sentra', 'Maxima', 'Rogue', 'Murano', 'Pathfinder', 'Frontier', 'Titan', 'Versa', 'Kicks', 'Armada', 'Leaf'],
  Ram: ['1500', '2500', '3500', 'ProMaster'],
  Subaru: ['Outback', 'Forester', 'Crosstrek', 'Impreza', 'Legacy', 'Ascent', 'WRX', 'BRZ'],
  Tesla: ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck'],
  Toyota: ['Camry', 'Corolla', 'RAV4', 'Highlander', 'Tacoma', 'Tundra', '4Runner', 'Prius', 'Sienna', 'Sequoia', 'Avalon', 'C-HR', 'Venza'],
  Volkswagen: ['Jetta', 'Passat', 'Golf', 'Tiguan', 'Atlas', 'Taos', 'Arteon', 'ID.4', 'Beetle'],
  Volvo: ['XC40', 'XC60', 'XC90', 'S60', 'S90', 'V60'],
}

/** Is this make one of our known dropdown makes? */
export function isKnownMake(make) {
  return typeof make === 'string' && VEHICLE_MAKES.includes(make)
}

/** Is this model listed under the given make? */
export function isKnownModel(make, model) {
  return isKnownMake(make) && Array.isArray(MAKE_MODELS[make]) && MAKE_MODELS[make].includes(model)
}
