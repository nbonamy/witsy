
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import { switchToTab } from './settings_utils'
import Settings from '../../src/screens/Settings.vue'

let wrapper: VueWrapper<any>
const voiceIndex = 7

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
    
  // wrapper
  document.body.innerHTML = `<dialog id="settings"></dialog>`
  wrapper = mount(Settings, { attachTo: '#settings' })
})

beforeEach(async () => {
  vi.clearAllMocks()
})

test('should render', async () => {
  const tab = await switchToTab(wrapper, voiceIndex)
  expect(tab.find('.list-panel').exists()).toBeTruthy()
  expect(tab.findComponent({ name: 'SettingsSTT' }).exists()).toBeTruthy()
})

test('stt settings', async () => {
  const tab = await switchToTab(wrapper, voiceIndex)
  await tab.find('.list-panel .list .item:nth-child(1)').trigger('click')
  const stt = tab.findComponent({ name: 'SettingsSTT' })
  expect(stt.find('select').element.value).toBe('openai')

  // silence detection
  expect(stt.findAll('select')[2].element.value).toBe('2000')
  await stt.findAll('select')[2].setValue('0')
  expect(store.config.stt.silenceDetection).toBe(false)
  expect(store.config.stt.silenceDuration).toBe(0)
  await stt.findAll('select')[2].setValue('1000')
  expect(store.config.stt.silenceDetection).toBe(true)
  expect(store.config.stt.silenceDuration).toBe(1000)

  // openai
  expect(stt.findAll('select')[1].element.value).toBe('whisper-1')

  // groq
  await stt.find('select').setValue('groq')
  expect(store.config.stt.engine).toBe('groq')
  expect(stt.findAll('select')[1].element.value).toBe('whisper-large-v3-turbo')
  const groq2 = stt.findAll('select')[1].findAll('option')[2]
  await stt.findAll('select')[1].setValue(groq2.element.value)
  expect(store.config.stt.model).toBe(groq2.element.value)

  // whisper
  await stt.find('select').setValue('whisper')
  expect(stt.findAll('select')[1].element.value).toBe('')
  const whisper2 = stt.findAll('select')[1].findAll('option')[2]
  await stt.findAll('select')[1].setValue(whisper2.element.value)
  expect(store.config.stt.engine).toBe('whisper')
  expect(store.config.stt.model).toBe(whisper2.element.value)

})

test('tts settings', async () => {
  const tab = await switchToTab(wrapper, voiceIndex)
  await tab.find('.list-panel .list .item:nth-child(2)').trigger('click')
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
  expect(store.config.tts.model).toBe('kokoro')
  expect(store.config.tts.voice).toBe('af')

})
