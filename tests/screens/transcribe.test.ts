
import { vi, beforeAll, beforeEach, expect, test, afterEach, Mock } from 'vitest'
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '../mocks/window'
import { createI18nMock } from '../mocks'
import { emitEventMock } from '../../vitest.setup'
import { store } from '../../src/renderer/services/store'
import Transcribe from '../../src/renderer/screens/Transcribe.vue'
import Waveform from '../../src/renderer/components/Waveform.vue'
import { TranscribeResponse } from '../../src/renderer/voice/stt'

enableAutoUnmount(afterEach)

vi.mock('../../src/renderer/services/i18n', async () => {
  return createI18nMock()
})


vi.mock('../../src/renderer/composables/transcriber', () => {
  return { default: vi.fn(() => ({
    transcriber: {
      initialize: vi.fn(),
      isReady: vi.fn(() => true),
      transcribe: vi.fn(async (): Promise<TranscribeResponse> => Promise.resolve({ text: 'transcribed' })),
      endStreaming: vi.fn(),
      streaming: false,
      requiresStreaming: false,
      requiresPcm16bits: false,
    },
    processStreamingError: vi.fn(),
  })) }
})

vi.mock('../../src/renderer/composables/dialog', () => ({
  default: {
    alert: vi.fn(() => Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false })),
    show: vi.fn(() => Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false })),
  }
}))

vi.mock('../../src/renderer/composables/audio_recorder', () => ({
  default: vi.fn(() => ({
    initialize: vi.fn(async () => Promise.resolve()),
    start: vi.fn(() => {
      // Simulate MediaRecorder start call
      window.MediaRecorder.prototype.start()
    }),
    stop: vi.fn(() => {
      // Simulate MediaRecorder stop call  
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
  }))
}))

beforeAll(() => {
  useWindowMock()
  useBrowserMock()
  store.loadCommands()
})

beforeEach(() => {
  vi.clearAllMocks()
  store.loadSettings()
})

test('Renders correctly', () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  expect(wrapper.exists()).toBe(true)
  expect(wrapper.find('[name=autoStart]').exists()).toBe(true)
  expect(wrapper.find<HTMLInputElement>('[name=autoStart]').element.disabled).toBe(false)
  expect(wrapper.find('[name=pushToTalk]').exists()).toBe(true)
  expect(wrapper.find<HTMLInputElement>('[name=pushToTalk]').element.disabled).toBe(false)
  expect(wrapper.find('.controls').exists()).toBe(true)
  expect(wrapper.find('.controls button[name=record]').exists()).toBe(true)
  expect(wrapper.find('.controls button[name=upload]').exists()).toBe(true)
  expect(wrapper.find('.controls input[type=file]').exists()).toBe(true)
  expect(wrapper.find('.controls .dropzone').exists()).toBe(true)
  expect(wrapper.find('.controls button[name=stop]').exists()).toBe(false)
  expect(wrapper.find('.visualizer').findComponent(Waveform).exists()).toBe(true)
  expect(wrapper.find('.result').exists()).toBe(true)
  expect(wrapper.find('.result textarea').exists()).toBe(true)
  expect(wrapper.find('.actions').exists()).toBe(true)
  expect(wrapper.find('.actions button[name=summarize]').exists()).toBe(true)
  expect(wrapper.find('.actions button[name=translate]').exists()).toBe(true)
  expect(wrapper.find('.actions button[name=commands]').exists()).toBe(true)
  expect(wrapper.find('.actions button[name=clear]').exists()).toBe(true)
  expect(wrapper.find('.actions button[name=insert]').exists()).toBe(true)
  expect(wrapper.find('.actions button[name=copy]').exists()).toBe(true)
})

test('Saves options', async () => {
  
  const wrapper: VueWrapper<any> = mount(Transcribe)
  
  await wrapper.find('[name=autoStart]').setValue(true)
  expect(store.config.stt.autoStart).toBe(true)
  expect(store.config.stt.pushToTalk).toBe(false)
  
  await wrapper.find('[name=autoStart]').setValue(false)
  await wrapper.find('[name=pushToTalk]').setValue(true)
  expect(store.config.stt.autoStart).toBe(false)
  expect(store.config.stt.pushToTalk).toBe(true)

  await wrapper.find('[name=autoStart]').setValue(false)
  expect(store.config.stt.autoStart).toBe(false)
  
  expect(window.api.config.save).toHaveBeenCalledTimes(3)
})

test('Records with button', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  await wrapper.find('.controls button[name=record]').trigger('click')
  await vi.waitUntil(() => ((window.MediaRecorder.prototype.start as Mock).mock.calls.length))
  expect(window.MediaRecorder.prototype.start).toHaveBeenCalled()
  expect(wrapper.find('.controls button[name=record]').exists()).toBe(false)
  expect(wrapper.find('.controls button[name=stop]').exists()).toBe(true)
  await wrapper.find('.controls button[name=stop]').trigger('click')
  expect(window.MediaRecorder.prototype.stop).toHaveBeenCalled()
})

test('Records with icon', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  await wrapper.find('.visualizer .record').trigger('click')
  await vi.waitUntil(() => ((window.MediaRecorder.prototype.start as Mock).mock.calls.length))
  expect(window.MediaRecorder.prototype.start).toHaveBeenCalled()
  expect(wrapper.find('.controls button[name=record]').exists()).toBe(false)
  expect(wrapper.find('.controls button[name=stop]').exists()).toBe(true)
  await wrapper.find('.controls button[name=stop]').trigger('click')
  expect(window.MediaRecorder.prototype.stop).toHaveBeenCalled()
  expect(wrapper.find('.visualizer .loader').exists()).toBe(true)
})

test('Records with space bar', async () => {
  mount(Transcribe)
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  await vi.waitUntil(() => ((window.MediaRecorder.prototype.start as Mock).mock.calls.length))
  expect(window.MediaRecorder.prototype.start).toHaveBeenCalled()
  document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
  expect(window.MediaRecorder.prototype.stop).not.toHaveBeenCalled()
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  expect(window.MediaRecorder.prototype.stop).toHaveBeenCalled()
})

test('Records with push to talk', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  wrapper.vm.pushToTalk = true
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  await vi.waitUntil(() => ((window.MediaRecorder.prototype.start as Mock).mock.calls.length))
  expect(window.MediaRecorder.prototype.start).toHaveBeenCalled()
  document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
  expect(window.MediaRecorder.prototype.stop).toHaveBeenCalled()
})

test('Transcribes', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  await wrapper.vm.transcribe(new Blob())
  expect(wrapper.vm.transcription).toBe('transcribed')
  wrapper.vm.transcription += '.'
  await wrapper.vm.transcribe(new Blob())
  expect(wrapper.vm.transcription).toBe('transcribed. transcribed')
})

test('Clears transcription', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  wrapper.vm.transcription = 'test'
  await wrapper.vm.$nextTick()
  await wrapper.find('.actions button[name=clear]').trigger('click')
  expect(wrapper.vm.transcription).toBe('')
})

test('Inserts transcription', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  wrapper.vm.transcription = 'test'
  await wrapper.vm.$nextTick()
  await wrapper.find('.actions button[name=insert]').trigger('click')
  expect(window.api.transcribe.insert).toHaveBeenCalledWith('test')
})

test('Copies transcription', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  wrapper.vm.transcription = 'test'
  await wrapper.vm.$nextTick()
  await wrapper.find('.actions button[name=copy]').trigger('click')
  expect(window.api.clipboard.writeText).toHaveBeenCalledWith('test')
})

test('Summarizes transcription', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  wrapper.vm.transcription = 'test'
  await wrapper.vm.$nextTick()
  await wrapper.find('.actions button[name=summarize]').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('new-chat', {
    prompt: 'transcribe.summarizePrompt',
    attachments: [ expect.objectContaining({ content: 'test_encoded' } ) ],
    submit: true,
  })
})

test('Translates transcription', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  wrapper.vm.transcription = 'test'
  await wrapper.vm.$nextTick()
  await wrapper.find('.actions button[name=translate]').trigger('click')
  await wrapper.find('.context-menu .item:nth-child(2)').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('new-chat', {
    prompt: 'transcribe.translatePrompt_default_lang=English UK',
    attachments: [ expect.objectContaining({ content: 'test_encoded' } ) ],
    submit: true,
  })
})

test('Commands transcription', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  wrapper.vm.transcription = 'test'
  await wrapper.vm.$nextTick()
  await wrapper.find('.actions button[name=commands]').trigger('click')
  await wrapper.find('.context-menu .item:nth-child(3)').trigger('click')
  expect(emitEventMock).toHaveBeenCalledWith('new-chat', {
    prompt: 'command_uuid3_template_test',
    submit: true,
  })
})

test('Keyboard shortcuts', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  wrapper.vm.transcription = 'test'
  await wrapper.vm.$nextTick()

  // copy
  document.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true, key: 'c' }));
  expect(window.api.clipboard.writeText).toHaveBeenCalledWith('test')

  // copy and close
  document.dispatchEvent(new KeyboardEvent('keydown', { shiftKey: true, metaKey: true, key: 'c' }));
  expect(window.api.clipboard.writeText).toHaveBeenNthCalledWith(2, 'test')
  expect(window.api.main.close).toHaveBeenCalled()
  
  // insert
  document.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true, key: 'i' }));
  expect(window.api.transcribe.insert).toHaveBeenNthCalledWith(1, 'test')

  // insert
  document.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true, key: 'Enter' }));
  expect(window.api.transcribe.insert).toHaveBeenNthCalledWith(2, 'test')

  // clear
  document.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true, key: 'x' }));
  expect(wrapper.vm.transcription).toBe('')
  
})
