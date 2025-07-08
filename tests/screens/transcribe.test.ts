
import { vi, beforeAll, beforeEach, expect, test, afterEach, Mock } from 'vitest'
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '../mocks/window'
import { store } from '../../src/services/store'
import Transcribe from '../../src/screens/Transcribe.vue'
import Waveform from '../../src/components/Waveform.vue'
import { TranscribeResponse } from '../../src/voice/stt'

enableAutoUnmount(afterEach)

const emitEventMock = vi.fn()

vi.mock('../../src/composables/transcriber', () => {
  return { default: vi.fn(() => ({
    transcriber: {
      initialize: vi.fn(),
      isReady: vi.fn(() => true),
      transcribe: vi.fn(async (): Promise<TranscribeResponse> => Promise.resolve({ text: 'transcribed' })),
      endStreaming: vi.fn(),
    },
    processStreamingError: vi.fn(),
  })) }
})

vi.mock('../../src/services/i18n', async () => {
  return {
    allLanguages: [ { locale: 'en-US', label: '🇬🇧 English UK' }, { locale: 'fr-FR', label: '🇫🇷 Français' } ],
    t: (key: string, values: Record<string, any>) => !values ? key : `${key}-${Object.values(values)}`,
    commandI18n: vi.fn(() => 'command {input} done'),
  }
})

vi.mock('../../src/composables/event_bus', async () => {
  return { default: () => ({
    emitEvent: emitEventMock
  })}
})

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
  await wrapper.vm.transcribe([])
  expect(wrapper.vm.transcription).toBe('transcribed')
  wrapper.vm.transcription += '.'
  await wrapper.vm.transcribe([])
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
    prompt: 'transcribe.translatePrompt-English UK',
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
    prompt: 'command test done',
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
