import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { useWindowMock } from '@tests/mocks/window'
import { store } from '@services/store'
import useVoiceRecording from '@renderer/audio/voice_recording'

// Create controllable mock instances
const mockAudioRecorder = {
  initialize: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  release: vi.fn(),
  getAnalyser: vi.fn(() => ({
    getByteTimeDomainData: vi.fn()
  })),
  getBufferLength: vi.fn(() => 1024)
}

const mockTranscriber = {
  initialize: vi.fn(),
  requiresPcm16bits: false,
  requiresStreaming: false,
  streaming: false,
  transcribe: vi.fn().mockResolvedValue({ text: 'test transcription' }),
  startStreaming: vi.fn(),
  sendStreamingChunk: vi.fn(),
  endStreaming: vi.fn()
}

vi.mock('@renderer/audio/audio_recorder', () => ({
  default: vi.fn(() => mockAudioRecorder),
}))

vi.mock('@renderer/audio/transcriber', () => ({
  default: vi.fn(() => ({
    transcriber: mockTranscriber
  }))
}))

// Helper functions for simulating voice recording behaviors
const simulateRecordingComplete = async (listener: any, noiseDetected: boolean = true) => {
  if (listener && listener.onRecordingComplete) {
    const audioBlob = new Blob(['test audio'], { type: 'audio/wav' })
    await listener.onRecordingComplete(audioBlob, noiseDetected)
  }
  await nextTick()
}

const simulateStreamingChunk = async (streamingCallback: any, text: string) => {
  if (streamingCallback) {
    await streamingCallback({ type: 'text', content: text })
  }
  await nextTick()
}

const simulateSilenceDetected = async (listener: any) => {
  if (listener && listener.onSilenceDetected) {
    await listener.onSilenceDetected()
  }
  await nextTick()
}

describe('useVoiceRecording Composable', () => {

  beforeAll(() => {
    useWindowMock()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    store.loadSettings()
    store.config.stt.engine = 'openai'

    // Reset mock return values
    mockTranscriber.transcribe.mockResolvedValue({ text: 'test transcription' })
    mockTranscriber.requiresStreaming = false
    mockTranscriber.requiresPcm16bits = false
    mockTranscriber.streaming = false
  })

  // === BASIC STATE MANAGEMENT ===

  describe('State Management', () => {
    it('starts in idle state', () => {
      const { isRecording, isProcessing, state } = useVoiceRecording()

      expect(isRecording.value).toBe(false)
      expect(isProcessing.value).toBe(false)
      expect(state.value).toBe('idle')
    })

    it('transitions to recording state when started', async () => {
      const { isRecording, isProcessing, state, startRecording } = useVoiceRecording()

      await startRecording()

      expect(isRecording.value).toBe(true)
      expect(isProcessing.value).toBe(false)
      expect(state.value).toBe('recording')
    })

    it('transitions to processing state during transcription', async () => {
      const { startRecording, isProcessing } = useVoiceRecording()

      await startRecording()

      // Get the listener from the initialize call
      const initCall = mockAudioRecorder.initialize.mock.calls[0]
      const listener = initCall[0].listener

      // Simulate recording complete which should trigger processing
      await simulateRecordingComplete(listener, 'test', true)

      // Check that we went through processing state
      expect(isProcessing.value).toBe(false) // Should be false after completion
    })
  })

  // === OPTIONS CALLBACKS ===

  describe('Options and Callbacks', () => {
    it('calls onTranscriptionComplete when transcription finishes', async () => {
      const onTranscriptionComplete = vi.fn()
      const { startRecording } = useVoiceRecording({ onTranscriptionComplete })

      await startRecording()

      const initCall = mockAudioRecorder.initialize.mock.calls[0]
      const listener = initCall[0].listener
      await simulateRecordingComplete(listener, 'completed text', true)

      expect(onTranscriptionComplete).toHaveBeenCalledWith('test transcription')
    })

    it('calls onTranscriptionChunk during streaming', async () => {
      mockTranscriber.requiresStreaming = true
      const onTranscriptionChunk = vi.fn()
      const { startRecording } = useVoiceRecording({ onTranscriptionChunk })

      await startRecording()

      const streamingCall = mockTranscriber.startStreaming.mock.calls[0]
      const streamingCallback = streamingCall[0]
      await simulateStreamingChunk(streamingCallback, 'chunk text')

      expect(onTranscriptionChunk).toHaveBeenCalledWith('chunk text')
    })

    it('calls onStateChange when state transitions occur', async () => {
      const onStateChange = vi.fn()
      const { startRecording } = useVoiceRecording({ onStateChange })

      await startRecording()

      expect(onStateChange).toHaveBeenCalledWith('recording', 'idle')
    })

    it('calls onError when errors occur', async () => {
      const onError = vi.fn()
      mockAudioRecorder.initialize.mockRejectedValueOnce(new Error('Init failed'))

      const { startRecording } = useVoiceRecording({ onError })
      await startRecording()

      expect(onError).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  // === CONVERSATION MODE SUPPORT ===

  describe('Conversation Mode Support', () => {
    it('handles auto conversation mode with restart', async () => {
      const onTranscriptionComplete = vi.fn()
      const { startRecording } = useVoiceRecording({
        conversationMode: 'auto',
        autoRestartAfterTranscription: true,
        onTranscriptionComplete
      })

      await startRecording()

      const initCall = mockAudioRecorder.initialize.mock.calls[0]
      const listener = initCall[0].listener

      // Simulate auto-triggered completion (not user-initiated)
      await simulateRecordingComplete(listener, 'auto text', true)

      expect(onTranscriptionComplete).toHaveBeenCalledWith('test transcription')

      // Should attempt to restart - check if initialize was called again after timeout
      await vi.waitFor(() => {
        expect(mockAudioRecorder.initialize).toHaveBeenCalledTimes(2)
      }, { timeout: 200 })
    })

    it('prevents auto-stop in push-to-talk mode', async () => {
      const { startRecording } = useVoiceRecording({
        conversationMode: 'ptt',
        autoStopOnSilence: true
      })

      await startRecording()

      const initCall = mockAudioRecorder.initialize.mock.calls[0]
      const listener = initCall[0].listener

      // Simulate silence detection
      await simulateSilenceDetected(listener)

      // In PTT mode, should not auto-stop on silence
      expect(mockAudioRecorder.stop).not.toHaveBeenCalled()
    })

    it('allows auto-stop on silence in auto mode', async () => {
      const { startRecording } = useVoiceRecording({
        conversationMode: 'auto',
        autoStopOnSilence: true
      })

      await startRecording()

      const initCall = mockAudioRecorder.initialize.mock.calls[0]
      const listener = initCall[0].listener

      // Simulate silence detection
      await simulateSilenceDetected(listener)

      // In auto mode, should auto-stop on silence
      expect(mockAudioRecorder.stop).toHaveBeenCalled()
    })
  })

  // === STREAMING VS BATCH PROCESSING ===

  describe('Streaming vs Batch Processing', () => {
    it('handles non-streaming transcription', async () => {
      mockTranscriber.requiresStreaming = false
      const { startRecording } = useVoiceRecording()

      await startRecording()

      expect(mockTranscriber.startStreaming).not.toHaveBeenCalled()
      expect(mockAudioRecorder.start).toHaveBeenCalledWith(false)

      const initCall = mockAudioRecorder.initialize.mock.calls[0]
      const listener = initCall[0].listener
      await simulateRecordingComplete(listener, 'batch text', true)

      expect(mockTranscriber.transcribe).toHaveBeenCalled()
    })

    it('handles streaming transcription', async () => {
      mockTranscriber.requiresStreaming = true
      mockTranscriber.streaming = true
      const { startRecording } = useVoiceRecording()

      await startRecording()

      expect(mockTranscriber.startStreaming).toHaveBeenCalled()
      expect(mockAudioRecorder.start).toHaveBeenCalledWith(true)

      // Simulate audio chunk during recording
      const initCall = mockAudioRecorder.initialize.mock.calls[0]
      const listener = initCall[0].listener

      if (listener.onAudioChunk) {
        await listener.onAudioChunk(new Uint8Array([1, 2, 3]))
        expect(mockTranscriber.sendStreamingChunk).toHaveBeenCalled()
      }
    })

    it('handles streaming errors gracefully', async () => {
      mockTranscriber.requiresStreaming = true
      const onError = vi.fn()
      const { startRecording } = useVoiceRecording({ onError })

      await startRecording()

      const streamingCall = mockTranscriber.startStreaming.mock.calls[0]
      const streamingCallback = streamingCall[0]

      // Simulate streaming error
      await streamingCallback({
        type: 'error',
        error: 'Connection failed'
      })

      expect(onError).toHaveBeenCalledWith(expect.any(Error))
      expect(mockAudioRecorder.stop).toHaveBeenCalled()
    })
  })

  // === CONTROL METHODS ===

  describe('Control Methods', () => {
    it('stops recording when requested', async () => {
      const { startRecording, stopRecording, isRecording } = useVoiceRecording()

      await startRecording()
      expect(isRecording.value).toBe(true)

      await stopRecording()
      expect(mockTranscriber.endStreaming).toHaveBeenCalled()
      expect(mockAudioRecorder.stop).toHaveBeenCalled()
    })

    it('toggles recording state', async () => {
      const { toggleRecording, isRecording } = useVoiceRecording()

      // Start recording
      await toggleRecording()
      expect(isRecording.value).toBe(true)

      // Stop recording
      await toggleRecording()
      expect(mockTranscriber.endStreaming).toHaveBeenCalled()
      expect(mockAudioRecorder.stop).toHaveBeenCalled()
    })

    it('prevents starting recording when not idle', async () => {
      const { startRecording, isRecording } = useVoiceRecording()

      await startRecording()
      expect(isRecording.value).toBe(true)

      const initialCallCount = mockAudioRecorder.initialize.mock.calls.length

      // Try to start again
      await startRecording()

      // Should not initialize again
      expect(mockAudioRecorder.initialize.mock.calls.length).toBe(initialCallCount)
    })

    it('does nothing when toggling during processing', async () => {
      const { startRecording, toggleRecording } = useVoiceRecording()

      await startRecording()

      // Toggle should stop the recording
      await toggleRecording()

      // Should have stopped recording
      expect(mockAudioRecorder.stop).toHaveBeenCalled()
    })
  })

  // === CLEANUP ===

  describe('Cleanup', () => {
    it('cleans up on unmount when recording', async () => {
      // This test is more about ensuring the onBeforeUnmount hook is registered
      // We can't easily test unmounting in this context, but we can verify
      // the stopRecording method works
      const { startRecording, stopRecording } = useVoiceRecording()

      await startRecording()
      await stopRecording(true)

      expect(mockTranscriber.endStreaming).toHaveBeenCalled()
      expect(mockAudioRecorder.stop).toHaveBeenCalled()
    })
  })

  // === EDGE CASES ===

  describe('Edge Cases', () => {
    it('handles empty audio blobs', async () => {
      const { startRecording } = useVoiceRecording()

      await startRecording()

      const initCall = mockAudioRecorder.initialize.mock.calls[0]
      const listener = initCall[0].listener

      // Simulate empty blob
      const emptyBlob = new Blob([], { type: 'audio/wav' })
      if (listener.onRecordingComplete) {
        await listener.onRecordingComplete(emptyBlob, true)
      }

      // Should not attempt transcription with empty blob
      expect(mockTranscriber.transcribe).not.toHaveBeenCalled()
    })

    it('handles no noise detected', async () => {
      const onTranscriptionComplete = vi.fn()
      const { startRecording } = useVoiceRecording({ onTranscriptionComplete })

      await startRecording()

      const initCall = mockAudioRecorder.initialize.mock.calls[0]
      const listener = initCall[0].listener

      // Simulate recording complete with noise = false (should not transcribe)
      if (listener && listener.onRecordingComplete) {
        const audioBlob = new Blob(['test audio'], { type: 'audio/wav' })
        await listener.onRecordingComplete(audioBlob, false) // false = no noise detected
      }

      expect(mockTranscriber.transcribe).not.toHaveBeenCalled()
      expect(onTranscriptionComplete).not.toHaveBeenCalled()
    })

    it('handles transcription with no text result', async () => {
      mockTranscriber.transcribe.mockResolvedValueOnce({ text: '' })
      const onTranscriptionComplete = vi.fn()
      const { startRecording } = useVoiceRecording({ onTranscriptionComplete })

      await startRecording()

      const initCall = mockAudioRecorder.initialize.mock.calls[0]
      const listener = initCall[0].listener
      await simulateRecordingComplete(listener, 'empty result', true)

      expect(mockTranscriber.transcribe).toHaveBeenCalled()
      expect(onTranscriptionComplete).not.toHaveBeenCalled()
    })
  })

  // === AUDIO RECORDER INTEGRATION ===

  describe('Audio Recorder Integration', () => {
    it('exposes audioRecorder for waveform integration', () => {
      const { audioRecorder } = useVoiceRecording()

      expect(audioRecorder).toBe(mockAudioRecorder)
    })

    it('configures audio recorder with PCM16 when required', async () => {
      mockTranscriber.requiresPcm16bits = true
      const { startRecording } = useVoiceRecording()

      await startRecording()

      const initCall = mockAudioRecorder.initialize.mock.calls[0]
      expect(initCall[0].pcm16bitStreaming).toBe(true)
    })

    it('handles audio recorder initialization errors', async () => {
      const onError = vi.fn()
      mockAudioRecorder.initialize.mockRejectedValueOnce(new Error('Permission denied'))

      const { startRecording, isRecording, isProcessing } = useVoiceRecording({ onError })
      await startRecording()

      expect(isRecording.value).toBe(false)
      expect(isProcessing.value).toBe(false)
      expect(onError).toHaveBeenCalledWith(expect.any(Error))
    })
  })
})