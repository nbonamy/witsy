<template>

  <textarea
    v-model="internalValue"
    :name="name"
    :placeholder="placeholder"
    :disabled="disabled || processing"
    :required="required"
    @input="onInput"
    @keyup="onKeyUp"
    ref="textareaRef"
    v-if="!isSTTReady(store.config)">
  </textarea>

  <div class="voice-textarea" v-else>
    <div class="textarea-wrapper">
      <textarea
        v-model="internalValue"
        :name="name"
        :placeholder="placeholder"
        :disabled="disabled || processing"
        :required="required"
        @input="onInput"
        @keyup="onKeyUp"
        ref="textareaRef"
        class="textarea"
      />
      <div class="voice-controls">
        <Waveform
          v-if="isRecording"
          :width="32"
          :height="12"
          foreground-color-inactive="var(--color-surface)"
          foreground-color-active="#1B4FB2"
          :audio-recorder="audioRecorder"
          :is-recording="true"
          class="waveform"
        />
        <ButtonIcon
          class="voice-button"
          @click="onToggleVoice"
          :class="{ 'recording': isRecording, 'processing': processing }"
        >
          <SpinningIcon v-if="processing" :spinning="true" />
          <MicIcon v-else :class="{ 'active': isRecording }" />
        </ButtonIcon>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MicIcon } from 'lucide-vue-next'
import { nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import useAudioRecorder from '../composables/audio_recorder'
import useTranscriber from '../composables/transcriber'
import { store } from '../services/store'
import { isSTTReady, StreamingChunk } from '../voice/stt'
import ButtonIcon from './ButtonIcon.vue'
import SpinningIcon from './SpinningIcon.vue'
import Waveform from './Waveform.vue'

interface Props {
  name?: string
  modelValue?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  required: false,
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Refs
const textareaRef = ref<HTMLTextAreaElement>()
const internalValue = ref(props.modelValue)
const isRecording = ref(false)
const processing = ref(false)

// Voice setup
const audioRecorder = useAudioRecorder(store.config)
const { transcriber } = useTranscriber(store.config)

// Watch for external value changes
watch(() => props.modelValue, (newValue) => {
  internalValue.value = newValue
})

// Watch for internal value changes and emit
watch(internalValue, (newValue) => {
  emit('update:modelValue', newValue)
})

// Methods
const onInput = () => {
  autoGrow()
}

const onKeyUp = () => {
  nextTick(() => {
    autoGrow()
  })
}

const autoGrow = () => {
  const textarea = textareaRef.value
  if (textarea) {
    textarea.style.height = '0px'
    textarea.style.height = Math.min(150, textarea.scrollHeight + 4) + 'px'
  }
}

const onToggleVoice = async () => {
  if (isRecording.value) {
    await stopRecording()
  } else {
    await startRecording()
  }
}

const startRecording = async () => {
  try {
    // Initialize transcriber
    transcriber.initialize()

    // Set up audio recorder
    await audioRecorder.initialize({
      pcm16bitStreaming: transcriber.requiresPcm16bits,
      listener: {
        onNoiseDetected: () => {
          // Visual feedback could be added here
        },

        onAudioChunk: async (chunk) => {
          if (transcriber.streaming) {
            await transcriber.sendStreamingChunk(chunk)
          }
        },

        onSilenceDetected: () => {
          // Auto-stop on silence
          stopRecording()
        },

        onRecordingComplete: async (audioBlob: Blob, noiseDetected: boolean) => {
          try {
            audioRecorder.release()
            isRecording.value = false

            if (audioBlob.size && noiseDetected) {
              processing.value = true
              const response = await transcriber.transcribe(audioBlob)
              if (response?.text) {
                internalValue.value = response.text
                autoGrow()
              }
            }
          } catch (error) {
            console.error('Error transcribing audio:', error)
          } finally {
            processing.value = false
          }
        }
      }
    })

    // Set up streaming if supported
    if (transcriber.requiresStreaming) {
      await transcriber.startStreaming(async (chunk: StreamingChunk) => {
        if (chunk.type === 'text') {
          internalValue.value = chunk.content
          autoGrow()
        } else if (chunk.type === 'error') {
          console.error('Streaming error:', chunk)
          isRecording.value = false
          audioRecorder.stop()
        }
      })
    }

    // Start recording
    isRecording.value = true
    audioRecorder.start(transcriber.requiresStreaming)

  } catch (error) {
    console.error('Error starting voice recording:', error)
    isRecording.value = false
  }
}

const stopRecording = async () => {
  try {
    transcriber.endStreaming()
    audioRecorder.stop()
  } catch (error) {
    console.error('Error stopping voice recording:', error)
  }
}

// Lifecycle
onMounted(() => {
  nextTick(() => {
    autoGrow()
  })
})

onBeforeUnmount(() => {
  if (isRecording.value) {
    stopRecording()
  }
})
</script>

<style scoped>

.voice-textarea {
  position: relative;
  width: 100%;

  .textarea-wrapper {
    position: relative;
    display: flex;
    align-items: flex-start;
    border: 1px solid var(--prompt-input-border-color);
    border-radius: var(--control-border-radius);
    background-color: var(--prompt-input-bg-color);

    .textarea {
      flex: 1;
      padding: 0.75rem !important;
      padding-right: 8rem !important;
      background-color: transparent;
      color: var(--prompt-input-text-color);
      border: none;
      resize: vertical;
      box-sizing: border-box;
      overflow-x: hidden;
      overflow-y: auto;
      font-family: inherit;
      font-size: inherit;
      line-height: 1.4;
    }

    .textarea::placeholder {
      color: var(--control-placeholder-text-color);
    }

    .textarea:focus {
      outline: none;
    }

    .textarea:disabled {
      color: var(--control-placeholder-text-color);
      cursor: not-allowed;
    }

    .voice-controls {
      position: absolute;
      right: 1rem;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .waveform {
      padding: 0.25rem;
    }

    .voice-button {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      background-color: var(--color-surface);
      border: 2px solid var(--prompt-input-border-color);
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .voice-button:hover {
      background-color: var(--color-surface-low);
      border-color: var(--highlight-color);
    }

    .voice-button.recording {
      background-color: rgba(var(--highlight-color-rgb), 0.15);
      border-color: var(--highlight-color);
      animation: pulse 1.5s infinite;
    }

    .voice-button.recording :deep(svg) {
      color: var(--highlight-color);
    }

    .voice-button.processing {
      background-color: rgba(var(--highlight-color-rgb), 0.1);
      border-color: var(--highlight-color);
    }

    .voice-button :deep(svg) {
      width: 1.25rem;
      height: 1.25rem;
      color: var(--prompt-icon-color);
    }

    .voice-button :deep(svg.active) {
      color: var(--highlight-color);
    }

    .voice-button :deep(svg) {
      color: var(--highlight-color);
    }

  }

}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--highlight-color-rgb), 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(var(--highlight-color-rgb), 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--highlight-color-rgb), 0);
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Scrollbar styling */
.textarea::-webkit-scrollbar {
  width: 0.25rem;
}

.textarea::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar-thumb-color);
  border-radius: 9999px;
}

.textarea::-webkit-scrollbar-thumb:hover {
  background-color: var(--scrollbar-thumb-color);
}

.textarea::-webkit-scrollbar-track {
  background-color: transparent;
  border-radius: 9999px;
}
</style>