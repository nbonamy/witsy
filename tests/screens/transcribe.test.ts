
import { vi, beforeAll, beforeEach, expect, test, afterEach } from 'vitest'
import { enableAutoUnmount, mount, VueWrapper } from '@vue/test-utils'
import { useWindowMock, useBrowserMock } from '../mocks/window'
import { store } from '../../src/services/store'
import Transcribe from '../../src/screens/Transcribe.vue'
import Waveform from '../../src/components/Waveform.vue'
import { TranscribeResponse } from '../../src/voice/stt'

enableAutoUnmount(afterEach)

vi.mock('../../src/composables/transcriber', () => {
  return { default: vi.fn(() => ({
    initialize: vi.fn(),
    isReady: vi.fn(() => true),
    transcribe: vi.fn(async (): Promise<TranscribeResponse> => Promise.resolve({ text: 'transcribed' })),
    endStreaming: vi.fn(),
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
  expect(wrapper.find('.controls').exists()).toBe(true)
  expect(wrapper.find('.controls .record').exists()).toBe(true)
  expect(wrapper.find('.controls').findComponent(Waveform).exists()).toBe(true)
  expect(wrapper.find('.result').exists()).toBe(true)
  expect(wrapper.find('.result textarea').exists()).toBe(true)
  expect(wrapper.find('.actions').exists()).toBe(true)
  expect(wrapper.find('.actions button[name=stop]').exists()).toBe(false)
  expect(wrapper.find('.actions button[name=record]').exists()).toBe(true)
  expect(wrapper.find('.actions button[name=clear]').exists()).toBe(true)
  expect(wrapper.find('.actions button[name=cancel]').exists()).toBe(true)
  expect(wrapper.find('.actions button[name=insert]').exists()).toBe(true)
  expect(wrapper.find('.actions button[name=copy]').exists()).toBe(true)
  expect(wrapper.find('.option').exists()).toBe(true)
  expect(wrapper.find('.option [name=autoStart]').exists()).toBe(true)
  expect(wrapper.find<HTMLInputElement>('.option [name=autoStart]').element.disabled).toBe(false)
  expect(wrapper.find('.option [name=pushToTalk]').exists()).toBe(true)
  expect(wrapper.find<HTMLInputElement>('.option [name=pushToTalk]').element.disabled).toBe(false)
})

test('Saves options', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  
  await wrapper.find('.option [name=autoStart]').setValue(true)
  expect(wrapper.find<HTMLInputElement>('.option [name=autoStart]').element.disabled).toBe(false)
  expect(wrapper.find<HTMLInputElement>('.option [name=pushToTalk]').element.disabled).toBe(true)
  expect(wrapper.vm.autoStart).toBe(true)
  expect(wrapper.vm.pushToTalk).toBe(false)
  expect(store.config.stt.autoStart).toBe(true)
  expect(store.config.stt.pushToTalk).toBe(false)
  
  await wrapper.find('.option [name=autoStart]').setValue(false)
  await wrapper.find('.option [name=pushToTalk]').setValue(true)
  expect(wrapper.vm.autoStart).toBe(false)
  expect(wrapper.vm.pushToTalk).toBe(true)
  expect(store.config.stt.autoStart).toBe(false)
  expect(store.config.stt.pushToTalk).toBe(true)
  expect(wrapper.find<HTMLInputElement>('.option [name=autoStart]').element.disabled).toBe(true)
  expect(wrapper.find<HTMLInputElement>('.option [name=pushToTalk]').element.disabled).toBe(false)
  
  await wrapper.find('.option [name=autoStart]').setValue(false)
  expect(wrapper.vm.autoStart).toBe(false)
  expect(store.config.stt.autoStart).toBe(false)
  
  expect(window.api.config.save).toHaveBeenCalledTimes(3)
})

test('Records with button', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
  await wrapper.find('.actions button[name=record]').trigger('click')
  expect(window.MediaRecorder.prototype.start).toHaveBeenCalled()
  expect(wrapper.find('.actions button[name=record]').exists()).toBe(false)
  expect(wrapper.find('.actions button[name=stop]').exists()).toBe(true)
  await wrapper.find('.actions button[name=stop]').trigger('click')
  expect(window.MediaRecorder.prototype.stop).toHaveBeenCalled()
})

test('Records with icon', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
  await wrapper.find('.controls .record').trigger('click')
  expect(window.MediaRecorder.prototype.start).toHaveBeenCalled()
  expect(wrapper.find('.controls .record').exists()).toBe(false)
  expect(wrapper.find('.controls .stop').exists()).toBe(true)
  await wrapper.find('.controls .stop').trigger('click')
  expect(window.MediaRecorder.prototype.stop).toHaveBeenCalled()
  expect(wrapper.find('.controls .loader').exists()).toBe(true)
})

test('Records with space bar', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  expect(window.MediaRecorder.prototype.start).toHaveBeenCalled()
  document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
  expect(window.MediaRecorder.prototype.stop).not.toHaveBeenCalled()
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  expect(window.MediaRecorder.prototype.stop).toHaveBeenCalled()
})

test('Records with push to talk', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
  wrapper.vm.pushToTalk = true
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  expect(window.MediaRecorder.prototype.start).toHaveBeenCalled()
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  expect(window.MediaRecorder.prototype.stop).not.toHaveBeenCalled()
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
  await wrapper.find('.actions button[name=clear]').trigger('click')
  expect(wrapper.vm.transcription).toBe('')
})

test('Inserts transcription', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  wrapper.vm.transcription = 'test'
  await wrapper.find('.actions button[name=insert]').trigger('click')
  expect(window.api.transcribe.insert).toHaveBeenCalledWith('test')
})

test('Copies transcription', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  wrapper.vm.transcription = 'test'
  await wrapper.find('.actions button[name=copy]').trigger('click')
  expect(window.api.clipboard.writeText).toHaveBeenCalledWith('test')
})

test('Close window', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  await wrapper.find('.actions button[name=cancel]').trigger('click')
  expect(window.api.transcribe.cancel).toHaveBeenCalled()
})

test('Keyboard shortcuts', async () => {
  const wrapper: VueWrapper<any> = mount(Transcribe)
  wrapper.vm.transcription = 'test'
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(window.api.transcribe.cancel).toHaveBeenCalled()
  document.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true, key: 'c' }));
  expect(window.api.clipboard.writeText).toHaveBeenCalledWith('test')
  document.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true, key: 'i' }));
  expect(window.api.transcribe.insert).toHaveBeenNthCalledWith(1, 'test')
  document.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true, key: 'Enter' }));
  expect(window.api.transcribe.insert).toHaveBeenNthCalledWith(2, 'test')
  // document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
  // expect(wrapper.vm.transcription).toBe('tes')
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
  expect(wrapper.vm.transcription).toBe('')
})
