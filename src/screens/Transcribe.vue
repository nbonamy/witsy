<template>
  <div class="transcribe panel-content">

    <div class="panel">

      <header>
        <div class="title">{{ t('transcribe.title') }}</div>
      </header>

      <main>
        <form class="vertical">

          <div class="panel-title">{{ t('common.settings') }}</div>

          <div class="group">
            <label>{{ t('settings.voice.engine') }}</label>
            <select name="engine" v-model="engine" @change="onChangeEngine">
              <option v-for="engine in getSTTEngines()" :key="engine.id" :value="engine.id">
                {{ engine.label }}
              </option>
            </select>
          </div>
          
          <div class="group">
            <label>{{ t('settings.voice.model') }}</label>
            <select name="model" v-model="model" @change="onChangeModel">
              <option v-for="model in getSTTModels(engine)" :key="model.id" :value="model.id">
                {{ model.label }}
              </option>
            </select>
          </div>

          <div class="group language">
            <label>{{ t('settings.voice.spokenLanguage') }}</label>
            <LangSelect v-model="locale" default-text="settings.voice.automatic" @change="save" />
          </div>

          <div class="group horizontal">
            <input type="checkbox" name="autoStart" v-model="autoStart" @change="save" :disabled="pushToTalk" />
            <label class="no-colon">{{ t('transcribe.autoStart') }}</label>
          </div>
          
          <div class="group horizontal">
            <input type="checkbox" name="pushToTalk" v-model="pushToTalk" @change="save" :disabled="autoStart" />
            <label class="no-colon">{{ t('transcribe.spaceToTalk') }}</label>
          </div>

        </form>

      </main>

    </div>

    <div class="content">

      <header>

      </header>

      <main>

        <div class="controls">
          <BIconRecordCircle v-if="state == 'recording'" class="stop" color="red" @click="onStop()" />
          <Loader class="loader" v-else-if="state === 'processing'" />
          <BIconRecordCircle v-else class="record" @click="onRecord(false)" />
          <Waveform :width="400" :height="32" :foreground-color-inactive="foregroundColorInactive" :foreground-color-active="foregroundColorActive" :audio-recorder="audioRecorder" :is-recording="state == 'recording'"/>
        </div>
        <div class="result">
          <textarea v-model="transcription" :placeholder="t('transcribe.clickToRecord') + ' ' + t(pushToTalk ? 'transcribe.spaceKeyHint.pushToTalk' : 'transcribe.spaceKeyHint.toggle')" />
        </div>
        <div class="actions">
          <form class="large" @submit.prevent>
            <button name="stop" class="button" v-if="state == 'recording'" @click="onStop()">{{ t('common.stop') }}</button>
            <button name="record" class="button" v-else @click="onRecord(false)" :disabled="state === 'processing'">{{ t('common.record') }}</button>
            <button name="clear" class="button" @click="onClear()" :disabled="state === 'processing'">{{ t('common.clear') }}</button>
            <div class="push"></div>
            <button name="insert" class="button" @click="onInsert()" v-if="!isMas">{{ t('common.insert') }}</button>
            <button name="copy" class="button" @click="onCopy()">{{ t('common.copy') }}</button>
          </form>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">

import { StreamingChunk } from '../voice/stt'
import { Ref, ref, computed, onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import { getSTTEngines, getSTTModels } from '../voice/stt'
import Waveform from '../components/Waveform.vue'
import Loader from '../components/Loader.vue'
import useTranscriber from '../composables/transcriber'
import useAudioRecorder from '../composables/audio_recorder'
import LangSelect from '../components/LangSelect.vue'
import Dialog from '../composables/dialog'

// init stuff
const { transcriber, processStreamingError } = useTranscriber(store.config)
const audioRecorder = useAudioRecorder(store.config)
let userStoppedDictation = false
let pushToTalkMode = false

const isMas = ref(false)
const engine = ref('')
const model = ref('')
const locale = ref('')
const pushToTalk = ref(false)
const state: Ref<'idle'|'recording'|'processing'> = ref('idle')
const transcription = ref('')
const autoStart = ref(false)
const foregroundColorActive = ref('')
const foregroundColorInactive = ref('')

const engineModel = computed(() => {
  return transcriber.engine ? transcriber.engine.name + ' / ' + transcriber.model : ''
})

let previousTranscription = ''

onMounted(async () => {

  // events
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  window.api.on('start-dictation', toggleRecord)
  window.api.on('file-modified', (file) => {
    if (file === 'settings') {
      load()
    }
  })

  // init
  load()
  await initializeAudio()

  // grab colors
  try {
    foregroundColorInactive.value = window.getComputedStyle(document.querySelector('.transcribe')).getPropertyValue('color')
    foregroundColorActive.value = window.getComputedStyle(document.querySelector('.controls')).getPropertyValue('color')
  } catch (error) {
    if (!process.env.TEST) {
      console.error('Error getting colors:', error)
    }
  }

  // auto start?
  if (autoStart.value) {
    onRecord(false)
  }

})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)
  window.api.off('start-dictation', toggleRecord)
  window.api.off('file-modified')
})

const load = () => {
  locale.value = store.config.stt.locale || ''
  engine.value = store.config.stt.engine
  model.value = store.config.stt.model
}

const onChangeEngine = () => {
  model.value = getSTTModels(engine.value)[0]?.id || ''
  onChangeModel()
}

const onChangeModel = async () => {
  save()
}

const initialize = async () => {

  // initialize the transcriber
  transcriber.initialize()
  await initializeAudio()
  if (transcriber.engine) {
    console.log('[stt]', transcriber.engine?.name, transcriber.model)
  }

  // other stuff
  autoStart.value = store.config.stt.autoStart
  pushToTalk.value = store.config.stt.pushToTalk
  isMas.value = window.api.isMasBuild

}

const toggleRecord = () => {
  if (state.value === 'processing') {
    return
  } else if (state.value === 'recording') {
    onStop()
  } else {
    onRecord(false)
  }
  refocus()
}

const initializeAudio = async () => {

  try {

    // init our recorder
    await audioRecorder.initialize({

      pcm16bitStreaming: transcriber.requiresPcm16bits,
      listener: {

        onNoiseDetected: () => {
        },

        onAudioChunk: async (chunk) => {
          if (transcriber.streaming) {
            await transcriber.sendStreamingChunk(chunk)
          }
        },

        onSilenceDetected: () => {

          // // depends on configuration
          // if (store.config.stt.silenceAction === 'nothing') {
          //   return
          // }

          // stop
          if (!pushToTalkMode) {
            stopDictation(false)
          }

        },

        onRecordingComplete: async (audioChunks: Blob[], noiseDetected: boolean) => {

          // if no noise stop everything
          if (!noiseDetected) {
            state.value = 'idle'
            return
          }

          // transcribe
          await transcribe(audioChunks)

          // execute?
          if (userStoppedDictation === false/* && store.config.stt.silenceAction === 'execute_continue'*/) {
            onRecord(false)
          }
        }

      }

    })

  } catch (err) {
    console.error('Error accessing microphone:', err)
    Dialog.alert(t('transcribe.errors.microphone'))
  }

}

const onRecord = async (ptt: boolean) => {

  // initialize
  await initialize()

  // check
  if (transcriber.ready === false) {
    Dialog.alert(t('transcribe.errors.notReady'))
    return
  }

  // save current transcription
  previousTranscription = transcription.value.trim()
  if (previousTranscription.length) {
    previousTranscription += ' '
  }

  // we need this
  let connected = true

  // streaming setup
  const useStreaming = transcriber.requiresStreaming
  if (useStreaming) {
    try {
      await transcriber.startStreaming(async (chunk: StreamingChunk) => {
        if (chunk.type === 'text') {
          transcription.value = `${previousTranscription}${chunk.content}`
        } else if (chunk.type === 'error') {
          await processStreamingError(chunk)
          state.value = 'idle'
          audioRecorder.stop()
          connected = false
        }
      })
    } catch (err) {
      console.error('Error in streaming:', err)
      Dialog.alert(t('transcribe.errors.unknown'))
      connected = false
    }
  }

  // check
  if (!connected) {
    return
  }

  try {
    
    // start the recording
    pushToTalkMode = ptt
    audioRecorder.start(useStreaming)

    // update the status
    state.value = 'recording'

  } catch (err) {
    console.error('Error accessing microphone:', err)
    Dialog.alert(t('transcribe.errors.microphone'))
  }

}

const onStop = () => {
  stopDictation(true)
  refocus()
}

const stopDictation = async (userStopped: boolean) => {
  userStoppedDictation = userStopped
  state.value = 'processing'
  transcriber.endStreaming()
  audioRecorder.stop()
}

const transcribe = async (audioChunks: any[]) => {

  try {

    const response = await transcriber.transcribe(audioChunks)

    // add a space if needed
    if (transcription.value.length && ',;.?!'.indexOf(transcription.value[transcription.value.length - 1]) !== -1 && response.text[0] !== ' ') {
      transcription.value += ' '
    }
    transcription.value += response.text

    // done
    state.value = 'idle'

  } catch (error) {
    console.error('Error:', error)
    Dialog.alert(t('transcribe.errors.transcription'), error.message)
  }

}

const onKeyDown = (event: KeyboardEvent) => {

  // if focus is on textarea, ignore
  if ((event.target as HTMLElement).nodeName === 'TEXTAREA') {
    return
  }

  // process
  const isCommand = !event.shiftKey && !event.altKey && (event.metaKey || event.ctrlKey)
  if (event.code === 'Space') {
    if (state.value !== 'recording') {
      onRecord(pushToTalk.value)
    } else if (!pushToTalk.value) {
      onStop()
    }
  } else if (event.key === 'Enter' && isCommand) {
    event.preventDefault()
    onInsert()
  // } else if (event.key === 'Backspace') {
  //   transcription.value = transcription.value.slice(0, -1)
  } else if (event.key === 'Delete') {
    onClear()
  } else if (event.key === 'c' && isCommand) {
    onCopy()
  } else if (event.key === 'i' && isCommand) {
    onInsert()
  }
}

const onKeyUp = (event: KeyboardEvent) => {

  // if focus is on textarea, ignore
  if ((event.target as HTMLElement).nodeName === 'TEXTAREA') {
    return
  }

  // process
  //const isCommand = !event.shiftKey && !event.altKey && (event.metaKey || event.ctrlKey)
  if (event.code === 'Space') {
    if (pushToTalkMode && state.value === 'recording') {
      onStop()
    }
  }
}

const onClear = () => {
  transcription.value = ''
  refocus()
}

const onCopy = async () => {
  window.api.clipboard.writeText(transcription.value)
  if (window.api.clipboard.readText() != transcription.value) {
    Dialog.alert(t('transcribe.errors.copy'))
    return
  }
}

const onInsert = () => {
  window.api.transcribe.insert(transcription.value)
}

const save = () => {
  store.config.stt.engine = engine.value
  store.config.stt.model = model.value
  store.config.stt.locale = locale.value
  store.config.stt.autoStart = autoStart.value
  store.config.stt.pushToTalk = pushToTalk.value
  store.saveSettings()
  refocus()
}

const refocus = () => {
  const focusedElement = document.activeElement as HTMLElement
  focusedElement?.blur()
}

</script>

<style scoped>
@import '../../css/form.css';
@import '../../css/panel-content.css';
</style>

<style scoped>

.transcribe {

  .panel {
    flex-basis: 240px;
    main {
      padding: 2rem 1.5rem;
    }
  }

  .content {

    main {

      padding-top: 12.5%;
      align-items: stretch;
      margin: 0 auto;
      width: 450px;

      .controls {
        margin-left: 8px;
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        font-size: 18pt;
        gap: 24px;
        align-items: center;
        color: var(--text-color);
      }

      .result {
        flex-basis: 50%;
        display: flex;
        margin-top: 16px;
        
        textarea {
          flex: 1;
          background-color: var(--control-textarea-bg-color);
          border: 0.25px solid var(--control-border-color);
          color: var(--text-color);
          border-radius: 6px;
          font-size: 11.5pt;
          padding: 8px;
          resize: none;

          &::placeholder {
            padding: 32px;
            position: relative !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
            text-align: center;
            line-height: 140%;
            font-family: Garamond, Georgia, Times, 'Times New Roman', serif;
            font-size: 14pt;
          }
        }
      }

      .actions {
        
        margin-top: 1rem;

        form {
          display: flex;
          flex-direction: row;
        }

        .push {
          flex: 1;
        }
      }

      .loader {
        margin: 8px 0px 8px 6px;
        background-color: orange;
      }
    }

  }

}

</style>