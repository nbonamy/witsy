
import { beforeAll, expect, test } from 'vitest'
import { useWindowMock } from '../mocks/window'
import { i18nInstructions, countryCodeToLangName } from '../../src/services/i18n'

beforeAll(() => {
  useWindowMock()
})

test('Localized instructions', async () => {

  expect(i18nInstructions({ instructions: {} }, 'instructions.default')).not.toBe('instructions.default')

  expect(i18nInstructions({ instructions: { titling: 'hello'} }, 'instructions.default')).not.toBe('instructions.default')

  expect(i18nInstructions({
    instructions: { default: 'Hello' }
   }, 'instructions.default')).toBe('Hello')

   expect(i18nInstructions({
    instructions: { scratchpad: { default: 'Hello' } }
   }, 'instructions.scratchpad.default')).toBe('Hello')

})

test('Country code to Name', async () => {
  expect(countryCodeToLangName('en')).toBe('English')
  expect(countryCodeToLangName('es')).toBe('Español')
  expect(countryCodeToLangName('fr')).toBe('Français')
  expect(countryCodeToLangName('de')).toBe('Deutsch')
  expect(countryCodeToLangName('it')).toBe('Italiano')
  expect(countryCodeToLangName('pt')).toBe('Português')
  expect(countryCodeToLangName('nl')).toBe('Nederlands')
  expect(countryCodeToLangName('pl')).toBe('Polski')
  expect(countryCodeToLangName('ru')).toBe('Русский')
  expect(countryCodeToLangName('ja')).toBe('日本語')
  expect(countryCodeToLangName('ko')).toBe('한국어')
  expect(countryCodeToLangName('zh')).toBe('中文')
  expect(countryCodeToLangName('vi')).toBe('Tiếng Việt')
  expect(countryCodeToLangName('th')).toBe('ไทย')
  expect(countryCodeToLangName('id')).toBe('Bahasa Indonesia')
  expect(countryCodeToLangName('hi')).toBe('हिन्दी')
  expect(countryCodeToLangName('ar')).toBe('العربية')
  expect(countryCodeToLangName('tr')).toBe('Türkçe')
  expect(countryCodeToLangName('ms')).toBe('Bahasa Melayu')
  expect(countryCodeToLangName('fi')).toBe('Filipino')
  expect(countryCodeToLangName('sw')).toBe('Kiswahili')
  expect(countryCodeToLangName('xx')).toBe('English')
})
