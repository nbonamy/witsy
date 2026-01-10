
import { vi, beforeAll, beforeEach, expect, test, afterEach } from 'vitest'
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '@tests/mocks/window'
import { createI18nMock } from '@tests/mocks'
import { store } from '@services/store'
import Dictation from '@screens/Dictation.vue'
import Waveform from '@components/Waveform.vue'
import { TranscribeResponse } from '@renderer/voice/stt'

enableAutoUnmount(afterEach)

vi.mock('@services/i18n', async () => {
  return createI18nMock()
})

const mockTranscriber = {
  initialize: vi.fn(),
  isReady: vi.fn(() => true),
  transcribe: vi.fn(async (): Promise<TranscribeResponse> => Promise.resolve({ text: 'transcribed text' })),
  endStreaming: vi.fn(),
  sendStreamingChunk: vi.fn(),
  streaming: false,
  requiresStreaming: false,
  requiresPcm16bits: false,
}

vi.mock('@renderer/audio/transcriber', () => {
  return { default: vi.fn(() => ({
    transcriber: mockTranscriber,
    reinitialize: vi.fn(),
    processStreamingError: vi.fn(),
  })) }
})

const mockAudioRecorder = {
  initialize: vi.fn(async () => Promise.resolve()),
  start: vi.fn(() => {
    window.MediaRecorder.prototype.start()
  }),
  stop: vi.fn(() => {
    window.MediaRecorder.prototype.stop()
  }),
  release: vi.fn(),
  getAnalyser: vi.fn(() => ({
    fftSize: 2048,
    frequencyBinCount: 1024,
    getFloatFrequencyData: vi.fn(),
    getByteFrequencyData: vi.fn(),
    getFloatTimeDomainData: vi.fn(),
    getByteTimeDomainData: vi.fn(),
  })),
  getBufferLength: vi.fn(() => 1024),
  getDataArray: vi.fn(() => new Uint8Array(1024)),
}

vi.mock('@renderer/audio/audio_recorder', () => ({
  default: vi.fn(() => mockAudioRecorder)
}))

beforeAll(() => {
  useWindowMock()
  useBrowserMock()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  store.loadSettings()
})

afterEach(() => {
  vi.useRealTimers()
})

test('Renders correctly', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('.dictation').exists()).toBe(true)
  expect(wrapper.find('.app-info').exists()).toBe(true)
  expect(wrapper.find('.visualizer').exists()).toBe(true)
  expect(wrapper.find('.status').exists()).toBe(true)
  expect(wrapper.findComponent(Waveform).exists()).toBe(true)
})

test('Initial state is idle', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)
  expect(wrapper.vm.state).toBe('idle')
  expect(wrapper.find('.hint').exists()).toBe(true)
})

test('Shows hint when recording', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)
  wrapper.vm.state = 'recording'
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.hint').exists()).toBe(true)
  expect(wrapper.find('.hint').text()).toContain('dictation.hint')
})

test('Shows recording indicator when recording', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)
  wrapper.vm.state = 'recording'
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.status .recording').exists()).toBe(true)
})

test('Shows processing state', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)
  wrapper.vm.state = 'processing'
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.processing').exists()).toBe(true)
  expect(wrapper.find('.hint').exists()).toBe(true)
})

test('Space key stops and transcribes when recording', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)
  wrapper.vm.state = 'recording'
  await wrapper.vm.$nextTick()

  document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))

  expect(wrapper.vm.state).toBe('processing')
  expect(mockTranscriber.endStreaming).toHaveBeenCalled()
  expect(mockAudioRecorder.stop).toHaveBeenCalled()
})

test('Space key does nothing when not recording', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)
  wrapper.vm.state = 'idle'
  await wrapper.vm.$nextTick()

  document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))

  expect(wrapper.vm.state).toBe('idle')
  expect(mockAudioRecorder.stop).not.toHaveBeenCalled()
})

test('Escape key stops and transcribes when recording', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)
  wrapper.vm.state = 'recording'
  await wrapper.vm.$nextTick()
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  expect(wrapper.vm.state).toBe('idle')
  expect(mockAudioRecorder.stop).toHaveBeenCalled()
  expect(mockAudioRecorder.release).toHaveBeenCalled()
  expect(window.api.dictation.close).toHaveBeenCalledWith('', null)
  expect(mockTranscriber.endStreaming).not.toHaveBeenCalled()
})

test('Escape closes window when idle', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)
  wrapper.vm.state = 'idle'
  await wrapper.vm.$nextTick()
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  expect(window.api.dictation.close).toHaveBeenCalled()
})

test('Escape closes window when initializing', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)
  wrapper.vm.state = 'initializing'
  await wrapper.vm.$nextTick()
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  expect(window.api.dictation.close).toHaveBeenCalled()
})

test('Notch appearance adds notch class', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)
  wrapper.vm.appearance = 'notch'
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.dictation.notch').exists()).toBe(true)
})

test('Panel appearance does not add notch class', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)
  wrapper.vm.appearance = 'panel'
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.dictation.notch').exists()).toBe(false)
})

test('Copies to clipboard when enabled', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)
  store.config.stt.quickDictation = { appearance: 'panel', copyToClipboard: true }

  await wrapper.vm.transcribeAndInsert(new Blob())

  expect(window.api.clipboard.writeText).toHaveBeenCalledWith('transcribed text')
  expect(window.api.dictation.close).toHaveBeenCalledWith('transcribed text', null)
})

test('Does not copy to clipboard when disabled', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)
  store.config.stt.quickDictation = { appearance: 'panel', copyToClipboard: false }

  await wrapper.vm.transcribeAndInsert(new Blob())

  expect(window.api.clipboard.writeText).not.toHaveBeenCalled()
  expect(window.api.dictation.close).toHaveBeenCalledWith('transcribed text', null)
})

test('Closes window after transcription', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)

  await wrapper.vm.transcribeAndInsert(new Blob())

  expect(window.api.dictation.close).toHaveBeenCalledWith('transcribed text', null)
})

test('Handles show event with sourceApp', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)
  const sourceApp = { name: 'TestApp', path: '/path/to/app' }

  await wrapper.vm.onShow({
    sourceApp: JSON.stringify(sourceApp),
    appearance: 'panel'
  })

  expect(wrapper.vm.sourceApp).toEqual(sourceApp)
})

test('Handles show event with notch appearance', async () => {
  const wrapper: VueWrapper<any> = mount(Dictation)

  await wrapper.vm.onShow({
    appearance: 'notch',
    notchHeight: '16'
  })

  expect(wrapper.vm.appearance).toBe('notch')
  expect(wrapper.vm.notchHeight).toBe(16)
})
