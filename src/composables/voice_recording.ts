import { ref, computed, onBeforeUnmount, readonly } from 'vue'
import { store } from '../services/store'
import useAudioRecorder from './audio_recorder'
import useTranscriber from './transcriber'
import { StreamingChunk } from '../voice/stt'

export type RecordingState = 'idle' | 'recording' | 'processing'

export interface VoiceRecordingOptions {
  // Output handling callbacks
  onTranscriptionComplete?: (text: string) => void
  onTranscriptionChunk?: (text: string) => void
  onStateChange?: (state: RecordingState, previousState: RecordingState) => void

  // Behavior configuration
  enableStreaming?: boolean
  autoStopOnSilence?: boolean

  // Conversation mode support (for Prompt component)
  conversationMode?: 'auto' | 'ptt' | null
  autoRestartAfterTranscription?: boolean

  // Error handling
  onError?: (error: Error) => void
}

export default function useVoiceRecording(options: VoiceRecordingOptions = {}) {

  // === CORE STATE ===
  const isRecording = ref(false)
  const isProcessing = ref(false)
  const state = computed<RecordingState>(() => {
    if (isProcessing.value) return 'processing'
    if (isRecording.value) return 'recording'
    return 'idle'
  })

  // === COMPOSABLES ===
  const audioRecorder = useAudioRecorder(store.config)
  const { transcriber } = useTranscriber(store.config)

  // === STATE TRACKING ===
  let userStoppedRecording = false
  let previousState: RecordingState = 'idle'

  // Watch state changes and notify
  const notifyStateChange = (newState: RecordingState) => {
    if (newState !== previousState && options.onStateChange) {
      options.onStateChange(newState, previousState)
      previousState = newState
    }
  }

  // === CORE RECORDING METHODS ===

  const startRecording = async (): Promise<void> => {
    try {
      if (state.value !== 'idle') return

      // Initialize transcriber
      transcriber.initialize()

      // Set up audio recorder with unified listener
      await audioRecorder.initialize({
        pcm16bitStreaming: transcriber.requiresPcm16bits,
        listener: {
          onNoiseDetected: () => {
            // Visual feedback could be handled by component
          },

          onAudioChunk: async (chunk) => {
            if (transcriber.streaming) {
              await transcriber.sendStreamingChunk(chunk)
            }
          },

          onSilenceDetected: () => {
            // Handle silence based on configuration
            if (options.autoStopOnSilence !== false) {
              // Don't auto-stop in push-to-talk mode
              if (options.conversationMode !== 'ptt') {
                stopRecording(false)
              }
            }
          },

          onRecordingComplete: async (audioBlob: Blob, noiseDetected: boolean) => {
            try {
              // Clean up recorder
              audioRecorder.release()
              isRecording.value = false
              notifyStateChange(state.value)

              // Process audio if noise was detected
              if (audioBlob.size && noiseDetected) {
                isProcessing.value = true
                notifyStateChange(state.value)

                const response = await transcriber.transcribe(audioBlob)
                if (response?.text) {
                  // Notify transcription complete
                  if (options.onTranscriptionComplete) {
                    options.onTranscriptionComplete(response.text)
                  }

                  // Handle auto-restart for conversation mode
                  if (options.autoRestartAfterTranscription &&
                      !userStoppedRecording &&
                      options.conversationMode === 'auto') {
                    // Auto-restart in conversation mode
                    setTimeout(() => startRecording(), 100)
                  }
                }
              }
            } catch (error) {
              console.error('Error in recording completion:', error)
              if (options.onError) {
                options.onError(error instanceof Error ? error : new Error(String(error)))
              }
            } finally {
              isProcessing.value = false
              notifyStateChange(state.value)
            }
          }
        }
      })

      // Set up streaming if supported
      if (transcriber.requiresStreaming) {
        await transcriber.startStreaming(async (chunk: StreamingChunk) => {
          if (chunk.type === 'text') {
            if (options.onTranscriptionChunk) {
              options.onTranscriptionChunk(chunk.content)
            }
          } else if (chunk.type === 'error') {
            console.error('Streaming error:', chunk)
            isRecording.value = false
            audioRecorder.stop()
            notifyStateChange(state.value)
            if (options.onError) {
              options.onError(new Error(chunk.error))
            }
          }
        })
      }

      // Start recording
      userStoppedRecording = false
      isRecording.value = true
      notifyStateChange(state.value)
      audioRecorder.start(transcriber.requiresStreaming)

    } catch (error) {
      console.error('Error starting voice recording:', error)
      isRecording.value = false
      isProcessing.value = false
      notifyStateChange(state.value)
      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  const stopRecording = async (userInitiated: boolean = true): Promise<void> => {
    try {
      userStoppedRecording = userInitiated
      transcriber.endStreaming()
      audioRecorder.stop()
    } catch (error) {
      console.error('Error stopping voice recording:', error)
      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  const toggleRecording = async (): Promise<void> => {
    if (state.value === 'recording') {
      await stopRecording(true)
    } else if (state.value === 'idle') {
      await startRecording()
    }
    // Do nothing if processing
  }

  // === CLEANUP ===
  onBeforeUnmount(() => {
    if (isRecording.value) {
      stopRecording(true)
    }
  })

  // === PUBLIC API ===
  return {
    // State
    isRecording: readonly(isRecording),
    isProcessing: readonly(isProcessing),
    state,

    // Methods
    startRecording,
    stopRecording,
    toggleRecording,

    // For waveform integration
    audioRecorder
  }
}