
import { vi, beforeAll, expect, test } from 'vitest'
import { app } from 'electron'
import { store } from '../../src/services/store'
import { createI18n } from 'vue-i18n'
import { useWindowMock } from '../mocks/window'
import { getLocaleUI, getLocaleLLM, useI18n } from '../../src/main/i18n'
import { commandI18n, commandI18nDefault, expertI18n, expertI18nDefault, i18nInstructions, localeToLangName } from '../../src/services/i18n'
import { Command, Expert } from '../../src/types'

vi.mock('electron', async() => {
  return {
    app: {
      getLocale: vi.fn(() => 'en-US'),
      getPath: vi.fn(() => '')
    },
  }
})

vi.mock('vue-i18n', async() => {
  return {
    createI18n: vi.fn(() => ({ global: { t: vi.fn((key => `mock.${key}`)) } }))
  }
})

vi.mock('../../src/main/config', async() => {
  return {
    loadSettings: vi.fn(() => store.config)
  }
})

beforeAll(() => {
  useWindowMock()
  store.config = {
    general: {
      locale: ''
    },
    llm: {
      locale: ''
    }
  }
})

test('Get UI Locale', async () => {
  
  // default to system language
  expect(getLocaleUI(app)).toBe('en-US')
  expect(getLocaleLLM(app)).toBe('en-US')

  // override llm locale
  store.config.llm.locale = 'fr-FR'
  expect(getLocaleUI(app)).toBe('en-US')
  expect(getLocaleLLM(app)).toBe('fr-FR')

  // override both
  store.config.general.locale = 'es-ES'
  expect(getLocaleUI(app)).toBe('es-ES')
  expect(getLocaleLLM(app)).toBe('fr-FR')

  // override only one
  store.config.llm.locale = ''
  expect(getLocaleUI(app)).toBe('es-ES')
  expect(getLocaleLLM(app)).toBe('es-ES')

})

test('Init i18n', async () => {

  store.config.general.locale = 'de-DE'
  useI18n(app)
  expect(createI18n).toHaveBeenLastCalledWith({
    legacy: false,
    locale: 'de-DE',
    fallbackLocale: 'en-US',
    missingWarn: false,
    fallbackWarn: false,
    warnHtmlMessage: false,
    messages: expect.any(Object)
  })

})

test('Localized instructions', async () => {

  expect(i18nInstructions({ instructions: {} }, 'instructions.chat.standard')).not.toBe('instructions.chat.standard')

  expect(i18nInstructions({ instructions: { titling: 'hello'} }, 'instructions.chat.standard')).not.toBe('instructions.chat.standard')

  expect(i18nInstructions({
    instructions: { chat: { standard: 'Hello' } }
   }, 'instructions.chat.standard')).toBe('Hello')

   expect(i18nInstructions({
    instructions: { scratchpad: { default: 'Hello' } }
   }, 'instructions.scratchpad.default')).toBe('Hello')

})

test('Command localization', async () => {
  expect(commandI18n({ id: 'uuid1' } as Command, 'label')).toBe('mock.commands.commands.uuid1.label')
  expect(commandI18n({ id: 'uuid1' } as Command, 'template')).toBe('mock.commands.commands.uuid1.template')
  expect(commandI18nDefault({ id: 'uuid1' } as Command, 'label')).toBe('mock.commands.commands.uuid1.label')
  expect(commandI18nDefault({ id: 'uuid1' } as Command, 'template')).toBe('mock.commands.commands.uuid1.template')
  expect(commandI18n({ id: 'uuid1', 'label': 'Label', template: 'Template' } as Command, 'label')).toBe('Label')
  expect(commandI18n({ id: 'uuid1', 'label': 'Label', template: 'Template' } as Command, 'template')).toBe('Template')
  expect(commandI18nDefault({ id: 'uuid1', 'label': 'Label', template: 'Template' } as Command, 'label')).toBe('mock.commands.commands.uuid1.label')
  expect(commandI18nDefault({ id: 'uuid1', 'label': 'Label', template: 'Template' } as Command, 'template')).toBe('mock.commands.commands.uuid1.template')
})

test('Expert localization', async () => {
  expect(expertI18n({ id: 'uuid1' } as Expert, 'name')).toBe('mock.experts.experts.uuid1.name')
  expect(expertI18n({ id: 'uuid1' } as Expert, 'prompt')).toBe('mock.experts.experts.uuid1.prompt')
  expect(expertI18nDefault({ id: 'uuid1' } as Expert, 'name')).toBe('mock.experts.experts.uuid1.name')
  expect(expertI18nDefault({ id: 'uuid1' } as Expert, 'prompt')).toBe('mock.experts.experts.uuid1.prompt')
  expect(expertI18n({ id: 'uuid1', 'name': 'Name', prompt: 'Prompt' } as Expert, 'name')).toBe('Name')
  expect(expertI18n({ id: 'uuid1', 'name': 'Name', prompt: 'Prompt' } as Expert, 'prompt')).toBe('Prompt')
  expect(expertI18nDefault({ id: 'uuid1', 'name': 'Name', prompt: 'Prompt' } as Expert, 'name')).toBe('mock.experts.experts.uuid1.name')
  expect(expertI18nDefault({ id: 'uuid1', 'name': 'Name', prompt: 'Prompt' } as Expert, 'prompt')).toBe('mock.experts.experts.uuid1.prompt')
})

test('Country code to Name', async () => {
  expect(localeToLangName('en-US')).toBe('mock.common.language.en-US')
  expect(localeToLangName('es-ES')).toBe('mock.common.language.es-ES')
  expect(localeToLangName('fr-FR')).toBe('mock.common.language.fr-FR')
  expect(localeToLangName('de-DE')).toBe('mock.common.language.de-DE')
  expect(localeToLangName('it-IT')).toBe('mock.common.language.it-IT')
  expect(localeToLangName('pt-PT')).toBe('mock.common.language.pt-PT')
  expect(localeToLangName('nl-NL')).toBe('mock.common.language.nl-NL')
  expect(localeToLangName('pl-PL')).toBe('mock.common.language.pl-PL')
  expect(localeToLangName('ru-RU')).toBe('mock.common.language.ru-RU')
  expect(localeToLangName('ja-JP')).toBe('mock.common.language.ja-JP')
  expect(localeToLangName('ko-KR')).toBe('mock.common.language.ko-KR')
  expect(localeToLangName('zh-CN')).toBe('mock.common.language.zh-CN')
  expect(localeToLangName('vi-VN')).toBe('mock.common.language.vi-VN')
  expect(localeToLangName('th-TH')).toBe('mock.common.language.th-TH')
  expect(localeToLangName('id-ID')).toBe('mock.common.language.id-ID')
  expect(localeToLangName('hi-IN')).toBe('mock.common.language.hi-IN')
  expect(localeToLangName('ar-SA')).toBe('mock.common.language.ar-SA')
  expect(localeToLangName('tr-TR')).toBe('mock.common.language.tr-TR')
  expect(localeToLangName('ms-MY')).toBe('mock.common.language.ms-MY')
  expect(localeToLangName('sw-KE')).toBe('mock.common.language.sw-KE')
  expect(localeToLangName('xx-XX')).toBe('mock.common.language.xx-XX')
})
