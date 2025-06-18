
import { vi, beforeAll, beforeEach, expect, test, afterEach, Mock } from 'vitest'
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '../mocks/window'
import { store } from '../../src/services/store'
import Transcribe from '../../src/screens/Transcribe.vue'
import Waveform from '../../src/components/Waveform.vue'
import { TranscribeResponse } from '../../src/voice/stt'

enableAutoUnmount(afterEach)

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

beforeAll(() => {
  useWindowMock()
  useBrowserMock()
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
  expect(wrapper.find('.controls .record').exists()).toBe(true)
  expect(wrapper.find('.controls').findComponent(Waveform).exists()).toBe(true)
  expect(wrapper.find('.result').exists()).toBe(true)
  expect(wrapper.find('.result textarea').exists()).toBe(true)
  expect(wrapper.find('.actions').exists()).toBe(true)
  expect(wrapper.find('.actions button[name=stop]').exists()).toBe(false)
  expect(wrapper.find('.actions button[name=record]').exists()).toBe(true)
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
  await wrapper.find('.actions button[name=record]').trigger('click')
  await vi.waitUntil(() => ((window.MediaRecorder.prototype.start as Mock).mock.calls.length))
  expect(window.MediaRecorder.prototype.start).toHaveBeenCalled()
  expect(wrapper.find('.actions button[name=record]').exists()).toBe(false)
  expect(wrapper.find('.actions button[name=stop]').exists()).toBe(true)
  await wrapper.find('.actions button[name=stop]').trigger('click')
  expect(window.MediaRecorder.prototype.stop).toHaveBeenCalled()
})

test('Records with icon', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  await wrapper.find('.controls .record').trigger('click')
  await vi.waitUntil(() => ((window.MediaRecorder.prototype.start as Mock).mock.calls.length))
  expect(window.MediaRecorder.prototype.start).toHaveBeenCalled()
  expect(wrapper.find('.controls .record').exists()).toBe(false)
  expect(wrapper.find('.controls .stop').exists()).toBe(true)
  await wrapper.find('.controls .stop').trigger('click')
  expect(window.MediaRecorder.prototype.stop).toHaveBeenCalled()
  expect(wrapper.find('.controls .loader').exists()).toBe(true)
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
  expect(window.api.closeMainWindow).toHaveBeenCalled()
  
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
