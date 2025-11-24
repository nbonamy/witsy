
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '@tests/mocks/window'
import { store } from '@services/store'
import { switchToTab, tabs } from './settings_utils'
import Settings from '@screens/Settings.vue'

let wrapper: VueWrapper<any>
const voiceIndex = tabs.indexOf('settingsVoice')

vi.mock('@renderer/voice/stt-whisper', async (importOriginal) => {
  const { default: STTWhisper } = await importOriginal<typeof import('@renderer/voice/stt-whisper')>()
  STTWhisper.prototype.isModelDownloaded = vi.fn(() => Promise.resolve(true))
  return { default: STTWhisper }
})

beforeAll(() => {
  useWindowMock()
  useBrowserMock()
  store.loadSettings()
  store.load = () => {}

  store.config.engines.falai.apiKey = 'falai-api-key'
    
  // wrapper
  wrapper = mount(Settings)
})

beforeEach(async () => {
  vi.clearAllMocks()
})

test('should render', async () => {
  const tab = await switchToTab(wrapper, voiceIndex)
  expect(tab.find('.master-detail').exists()).toBeTruthy()
  expect(tab.findComponent({ name: 'SettingsSTT' }).exists()).toBeTruthy()
})

test('stt settings', async () => {
  const tab = await switchToTab(wrapper, voiceIndex)
  await tab.find('.master-detail .md-master-list .md-master-list-item:nth-child(1)').trigger('click')
  const stt = tab.findComponent({ name: 'SettingsSTT' })
  expect(stt.find<HTMLSelectElement>('select[name=engine]').element.value).toBe('openai')

  // language
  expect(stt.find<HTMLSelectElement>('select[name=locale]').element.value).toBe('')
  await stt.find('select[name=locale]').setValue('fr-FR')
  expect(store.config.stt.locale).toBe('fr-FR')

  // vocabulary
  expect(stt.find<HTMLTextAreaElement>('textarea[name=vocabulary]').element.value).toBe('')
  await stt.find('textarea[name=vocabulary]').setValue('word1\nword2\nword3')
  expect(store.config.stt.vocabulary).toStrictEqual([
    { text: 'word1' }, { text: 'word2' }, { text: 'word3' }
  ])

  // silence detection
  expect(stt.find<HTMLSelectElement>('select[name=duration]').element.value).toBe('2000')
  await stt.find('select[name=duration]').setValue('0')
  expect(store.config.stt.silenceDetection).toBe(false)
  expect(store.config.stt.silenceDuration).toBe(0)
  await stt.find('select[name=duration]').setValue('1000')
  expect(store.config.stt.silenceDetection).toBe(true)
  expect(store.config.stt.silenceDuration).toBe(1000)

  // openai
  expect(stt.find<HTMLSelectElement>('select[name=model]').element.value).toBe('gpt-4o-transcribe')

  // groq
  await stt.find('select[name=engine]').setValue('groq')
  expect(store.config.stt.engine).toBe('groq')
  expect(stt.find<HTMLSelectElement>('select[name=model]').element.value).toBe('whisper-large-v3-turbo')
  const groq2 = stt.find('select[name=model]').findAll('option')[2]
  await stt.find<HTMLSelectElement>('select[name=model]').setValue(groq2.element.value)
  expect(store.config.stt.model).toBe(groq2.element.value)

  // fal.ai
  await stt.find('select[name=engine]').setValue('falai')
  expect(store.config.stt.engine).toBe('falai')
  expect(stt.find<HTMLInputElement>('input').element.value).toBe('falai-api-key')
  expect(stt.find<HTMLSelectElement>('select[name=model]').element.value).toBe('fal-ai/whisper')
  const falai2 = stt.find('select[name=model]').findAll('option')[1]
  await stt.find<HTMLSelectElement>('select[name=model]').setValue(falai2.element.value)
  expect(store.config.stt.model).toBe(falai2.element.value)

  // whisper
  await stt.find('select[name=engine]').setValue('whisper')
  expect(stt.find<HTMLSelectElement>('select[name=model]').element.value).toBe('')
  const whisper2 = stt.find('select[name=model]').findAll('option')[2]
  await stt.find<HTMLSelectElement>('select[name=model]').setValue(whisper2.element.value)
  expect(store.config.stt.engine).toBe('whisper')
  expect(store.config.stt.model).toBe(whisper2.element.value)

  // custom
  await stt.find('select[name=engine]').setValue('custom')
  expect(stt.find<HTMLSelectElement>('select[name=model]').exists()).toBe(false)
  expect(stt.find<HTMLSelectElement>('input[name=baseURL]').exists()).toBe(true)
  expect(stt.find<HTMLSelectElement>('input[name=model]').exists()).toBe(true)
  await stt.find<HTMLSelectElement>('input[name=baseURL]').setValue('https://api.custom.com')
  await stt.find<HTMLInputElement>('input[name=model]').setValue('custom-model')
  expect(store.config.stt.engine).toBe('custom')
  expect(store.config.stt.model).toBe('custom-model')
  expect(store.config.stt.customOpenAI.baseURL).toBe('https://api.custom.com')

})

test('stt vocabulary load', async () => {

  store.config.stt.vocabulary = [
    { text: 'word1' }, { text: 'word2' }, { text: 'word3' }
  ]  

  const tab = await switchToTab(wrapper, voiceIndex)
  await tab.find('.master-detail .md-master-list .md-master-list-item:nth-child(1)').trigger('click')
  const stt = tab.findComponent({ name: 'SettingsSTT' })

  expect(stt.find<HTMLTextAreaElement>('textarea[name=vocabulary]').element.value).toBe('word1\nword2\nword3')

})

test('tts settings', async () => {
  const tab = await switchToTab(wrapper, voiceIndex)
  await tab.find('.master-detail .md-master-list .md-master-list-item:nth-child(2)').trigger('click')
  const tts = tab.findComponent({ name: 'SettingsTTS' })

  // model
  expect(tts.findAll('select')[1].element.value).toBe(store.config.tts.model)
  const model2 = tts.findAll('select')[1].findAll('option')[1]
  await tts.findAll('select')[1].setValue(model2.element.value)
  expect(store.config.tts.model).toBe(model2.element.value)

  // voice
  expect(tts.findAll('select')[2].element.value).toBe(store.config.tts.voice)
  const voice2 = tts.findAll('select')[2].findAll('option')[2]
  await tts.findAll('select')[2].setValue(voice2.element.value)
  expect(store.config.tts.voice).toBe(voice2.element.value)

  // engine (last as kokoro has only one option)
  expect(tts.findAll('select')[0].element.value).toBe(store.config.tts.engine)
  const engine2 = tts.findAll('select')[0].findAll('option')[1]
  await tts.findAll('select')[0].setValue(engine2.element.value)
  expect(store.config.tts.engine).toBe(engine2.element.value)

})
