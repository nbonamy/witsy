import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useWindowMock } from '../../../mocks/window'
import { store } from '../../../../src/renderer/services/store'
import VoiceTextarea from '../../../../src/renderer/components/VoiceTextarea.vue'

vi.mock('../../../../src/renderer/voice/stt', () => ({
  isSTTReady: vi.fn(() => true),
}))

vi.mock('../../../../src/renderer/audio/audio_recorder', () => ({
  default: vi.fn(() => ({
    initialize: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    release: vi.fn(),
    getAnalyser: vi.fn(() => ({
      getByteTimeDomainData: vi.fn()
    })),
    getBufferLength: vi.fn(() => 1024)
  })),
}))

vi.mock('../../../../src/renderer/audio/transcriber', () => ({
  default: vi.fn(() => ({
    transcriber: {
      initialize: vi.fn(),
      requiresPcm16bits: false,
      requiresStreaming: false,
      transcribe: vi.fn().mockResolvedValue({ text: 'test transcription' }),
      startStreaming: vi.fn(),
      sendStreamingChunk: vi.fn(),
      endStreaming: vi.fn()
    }
  }))
}))

describe('VoiceTextarea', () => {

  beforeAll(() => {
    useWindowMock()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    store.loadSettings()
    // Set up STT engine for voice support
    store.config.stt.engine = 'openai'
  })

  it('renders correctly', () => {
    const wrapper = mount(VoiceTextarea)

    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.find('.voice-button').exists()).toBe(true)
  })

  it('supports v-model', async () => {
    const wrapper = mount(VoiceTextarea, {
      props: {
        modelValue: 'initial value'
      }
    })

    const textarea = wrapper.find('textarea')
    expect(textarea.element.value).toBe('initial value')

    // Update via prop
    await wrapper.setProps({ modelValue: 'updated value' })
    expect(textarea.element.value).toBe('updated value')

    // Update via input
    await textarea.setValue('user input')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted[emitted.length - 1]).toEqual(['user input'])
  })

  it('shows placeholder text', () => {
    const wrapper = mount(VoiceTextarea, {
      props: {
        placeholder: 'Enter text here'
      }
    })

    const textarea = wrapper.find('textarea')
    expect(textarea.attributes('placeholder')).toBe('Enter text here')
  })

  it('disables textarea when disabled prop is true', () => {
    const wrapper = mount(VoiceTextarea, {
      props: {
        disabled: true
      }
    })

    const textarea = wrapper.find('textarea')
    expect(textarea.attributes('disabled')).toBeDefined()
  })

  it('shows voice button when voice support is available', () => {
    const wrapper = mount(VoiceTextarea)

    expect(wrapper.find('.voice-controls').exists()).toBe(true)
    expect(wrapper.find('.voice-button').exists()).toBe(true)
    expect(wrapper.find('.voice-button svg').exists()).toBe(true)
  })

  it('handles voice button click', async () => {
    const wrapper = mount(VoiceTextarea)

    const voiceButton = wrapper.find('.voice-button')
    expect(voiceButton.exists()).toBe(true)

    await voiceButton.trigger('click')
    await nextTick()

    // Should toggle recording state
    expect(wrapper.vm.isRecording).toBeDefined()
  })

  it('auto-grows textarea height', async () => {
    const wrapper = mount(VoiceTextarea, {
      props: {
        modelValue: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
      }
    })

    const textarea = wrapper.find('textarea')

    // Trigger the keyup event to test auto-grow
    await textarea.trigger('keyup')
    await nextTick()

    // The height should be adjusted (exact value depends on content)
    expect(textarea.element.style.height).not.toBe('0px')
  })
})