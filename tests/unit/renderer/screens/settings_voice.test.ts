
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
  // Default view is now STT Model
  expect(tab.findComponent({ name: 'SettingsSTTModel' }).exists()).toBeTruthy()
})

test('stt settings', async () => {
  const tab = await switchToTab(wrapper, voiceIndex)

  // STT Model is first item (after header), already loaded by default
  const sttModel = tab.findComponent({ name: 'SettingsSTTModel' })
  expect(sttModel.find<HTMLSelectElement>('select[name=engine]').element.value).toBe('openai')

  // openai
  expect(sttModel.find<HTMLSelectElement>('select[name=model]').element.value).toBe('gpt-4o-transcribe')

  // groq
  await sttModel.find('select[name=engine]').setValue('groq')
  expect(store.config.stt.engine).toBe('groq')
  expect(sttModel.find<HTMLSelectElement>('select[name=model]').element.value).toBe('whisper-large-v3-turbo')
  const groq2 = sttModel.find('select[name=model]').findAll('option')[2]
  await sttModel.find<HTMLSelectElement>('select[name=model]').setValue(groq2.element.value)
  expect(store.config.stt.model).toBe(groq2.element.value)

  // fal.ai
  await sttModel.find('select[name=engine]').setValue('falai')
  expect(store.config.stt.engine).toBe('falai')
  expect(sttModel.find<HTMLInputElement>('input').element.value).toBe('falai-api-key')
  expect(sttModel.find<HTMLSelectElement>('select[name=model]').element.value).toBe('fal-ai/whisper')
  const falai2 = sttModel.find('select[name=model]').findAll('option')[1]
  await sttModel.find<HTMLSelectElement>('select[name=model]').setValue(falai2.element.value)
  expect(store.config.stt.model).toBe(falai2.element.value)

  // whisper
  await sttModel.find('select[name=engine]').setValue('whisper')
  expect(sttModel.find<HTMLSelectElement>('select[name=model]').element.value).toBe('')
  const whisper2 = sttModel.find('select[name=model]').findAll('option')[2]
  await sttModel.find<HTMLSelectElement>('select[name=model]').setValue(whisper2.element.value)
  expect(store.config.stt.engine).toBe('whisper')
  expect(store.config.stt.model).toBe(whisper2.element.value)

  // custom
  await sttModel.find('select[name=engine]').setValue('custom')
  expect(sttModel.find<HTMLSelectElement>('select[name=model]').exists()).toBe(false)
  expect(sttModel.find<HTMLSelectElement>('input[name=baseURL]').exists()).toBe(true)
  expect(sttModel.find<HTMLSelectElement>('input[name=model]').exists()).toBe(true)
  await sttModel.find<HTMLSelectElement>('input[name=baseURL]').setValue('https://api.custom.com')
  await sttModel.find<HTMLInputElement>('input[name=model]').setValue('custom-model')
  expect(store.config.stt.engine).toBe('custom')
  expect(store.config.stt.model).toBe('custom-model')
  expect(store.config.stt.customOpenAI.baseURL).toBe('https://api.custom.com')

  // Switch to Configuration view (2nd clickable item: sttModel=0, sttConfig=1)
  const items = tab.findAll('.master-detail .md-master-list .md-master-list-item')
  await items[1].trigger('click')
  const sttConfig = tab.findComponent({ name: 'SettingsSTTConfiguration' })

  // language
  expect(sttConfig.find<HTMLSelectElement>('select[name=locale]').element.value).toBe('')
  await sttConfig.find('select[name=locale]').setValue('fr-FR')
  expect(store.config.stt.locale).toBe('fr-FR')

  // vocabulary
  expect(sttConfig.find<HTMLTextAreaElement>('textarea[name=vocabulary]').element.value).toBe('')
  await sttConfig.find('textarea[name=vocabulary]').setValue('word1\nword2\nword3')
  expect(store.config.stt.vocabulary).toStrictEqual([
    { text: 'word1' }, { text: 'word2' }, { text: 'word3' }
  ])

  // silence detection
  expect(sttConfig.find<HTMLSelectElement>('select[name=duration]').element.value).toBe('2000')
  await sttConfig.find('select[name=duration]').setValue('0')
  expect(store.config.stt.silenceDetection).toBe(false)
  expect(store.config.stt.silenceDuration).toBe(0)
  await sttConfig.find('select[name=duration]').setValue('1000')
  expect(store.config.stt.silenceDetection).toBe(true)
  expect(store.config.stt.silenceDuration).toBe(1000)

})

test('stt vocabulary load', async () => {

  store.config.stt.vocabulary = [
    { text: 'word1' }, { text: 'word2' }, { text: 'word3' }
  ]

  const tab = await switchToTab(wrapper, voiceIndex)
  // Click on Configuration (2nd clickable item: sttModel=0, sttConfig=1)
  const items = tab.findAll('.master-detail .md-master-list .md-master-list-item')
  await items[1].trigger('click')
  const sttConfig = tab.findComponent({ name: 'SettingsSTTConfiguration' })

  expect(sttConfig.find<HTMLTextAreaElement>('textarea[name=vocabulary]').element.value).toBe('word1\nword2\nword3')

})

test('tts settings', async () => {
  const tab = await switchToTab(wrapper, voiceIndex)
  // Find all clickable items and click the 4th one (ttsModel: sttModel=0, sttConfig=1, quickDictation=2, ttsModel=3)
  const items = tab.findAll('.master-detail .md-master-list .md-master-list-item')
  await items[3].trigger('click')
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

test('quick dictation settings', async () => {
  const tab = await switchToTab(wrapper, voiceIndex)
  // Find all clickable items and click the 3rd one (quickDictation: sttModel=0, sttConfig=1, quickDictation=2)
  const items = tab.findAll('.master-detail .md-master-list .md-master-list-item')
  await items[2].trigger('click')
  const quickDictation = tab.findComponent({ name: 'SettingsQuickDictation' })

  // appearance - default should be 'panel'
  expect(quickDictation.find<HTMLSelectElement>('select[name=appearance]').element.value).toBe('panel')

  // notch option should be available on macOS (mocked as darwin in window mock)
  const appearanceOptions = quickDictation.find('select[name=appearance]').findAll('option')
  expect(appearanceOptions.length).toBeGreaterThan(1)
  expect(appearanceOptions.some(opt => opt.element.value === 'notch')).toBe(true)

  // copy to clipboard - default should be false
  expect(quickDictation.find<HTMLInputElement>('input#copy-to-clipboard').element.checked).toBe(false)

  // change copy to clipboard
  await quickDictation.find('input#copy-to-clipboard').setValue(true)
  expect(store.config.stt.quickDictation.copyToClipboard).toBe(true)

  // change appearance to notch
  await quickDictation.find('select[name=appearance]').setValue('notch')
  expect(store.config.stt.quickDictation.appearance).toBe('notch')

})

test('quick dictation load settings', async () => {
  // Set config
  store.config.stt.quickDictation = {
    appearance: 'notch',
    copyToClipboard: true
  }

  const tab = await switchToTab(wrapper, voiceIndex)
  const items = tab.findAll('.master-detail .md-master-list .md-master-list-item')
  await items[2].trigger('click')
  const quickDictation = tab.findComponent({ name: 'SettingsQuickDictation' })

  // should load saved values
  expect(quickDictation.find<HTMLSelectElement>('select[name=appearance]').element.value).toBe('notch')
  expect(quickDictation.find<HTMLInputElement>('input#copy-to-clipboard').element.checked).toBe(true)

})
