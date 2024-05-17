
import { expect, test } from 'vitest'
import { countryCodeToName } from '../../src/services/i18n'

test('Country code to Name', async () => {
  expect(countryCodeToName('en')).toBe('English')
  expect(countryCodeToName('es')).toBe('Spanish')
  expect(countryCodeToName('fr')).toBe('French')
  expect(countryCodeToName('de')).toBe('German')
  expect(countryCodeToName('it')).toBe('Italian')
  expect(countryCodeToName('pt')).toBe('Portuguese')
  expect(countryCodeToName('nl')).toBe('Dutch')
  expect(countryCodeToName('pl')).toBe('Polish')
  expect(countryCodeToName('ru')).toBe('Russian')
  expect(countryCodeToName('ja')).toBe('Japanese')
  expect(countryCodeToName('ko')).toBe('Korean')
  expect(countryCodeToName('zh')).toBe('Chinese')
  expect(countryCodeToName('vi')).toBe('Vietnamese')
  expect(countryCodeToName('th')).toBe('Thai')
  expect(countryCodeToName('id')).toBe('Indonesian')
  expect(countryCodeToName('hi')).toBe('Hindi')
  expect(countryCodeToName('ar')).toBe('Arabic')
  expect(countryCodeToName('tr')).toBe('Turkish')
  expect(countryCodeToName('ms')).toBe('Malay')
  expect(countryCodeToName('fi')).toBe(' Filipino')
  expect(countryCodeToName('sw')).toBe('Swahili')
  expect(countryCodeToName('xx')).toBe('English')
})
