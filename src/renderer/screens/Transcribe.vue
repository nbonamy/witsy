<template>
  <div class="transcribe split-pane">

    <div class="sp-sidebar">

      <header>
        <div class="title">{{ t('transcribe.title') }}</div>
      </header>

      <main>
        <div class="form form-large form-vertical">

          <div class="form-field">
            <label>{{ t('settings.voice.engine') }}</label>
            <select name="engine" v-model="engine" @change="onChangeEngine">
              <option v-for="engine in getSTTEngines()" :key="engine.id" :value="engine.id">
                {{ engine.label }}
              </option>
            </select>
          </div>
          
          <div class="form-field">
            <label>{{ t('settings.voice.model') }}</label>
            <select name="model" v-model="model" @change="onChangeModel">
              <option v-for="model in models" :key="model.id" :value="model.id">
                {{ model.label }}
              </option>
            </select>
          </div>

          <div class="form-field language">
            <label>{{ t('settings.voice.spokenLanguage') }}</label>
            <LangSelect v-model="locale" default-text="settings.voice.automatic" @change="save" />
          </div>

          <div class="form-field horizontal">
            <input type="checkbox" name="autoStart" v-model="autoStart" @change="save" />
            <label class="no-colon">{{ t('transcribe.autoStart') }}</label>
          </div>
          
          <div class="form-field horizontal">
            <input type="checkbox" name="pushToTalk" v-model="pushToTalk" @change="save" />
            <label class="no-colon">{{ t('transcribe.spaceToTalk') }}</label>
          </div>

        </div>

      </main>

    </div>

    <div class="sp-main" @drop="onDrop" @dragover="onDragOver" @dragenter="onDragEnter" @dragleave="onDragLeave" >

      <main>

        <div class="controls">
          <div class="form form-large">
            <button name="stop" class="button" v-if="state == 'recording'" @click="onStop()">{{ t('common.stop') }}</button>
            <button name="record" class="button" v-else @click="onRecord(false)" :disabled="state === 'processing'"><MicIcon />&nbsp;{{ t('common.record') }}</button>
            <input ref="fileInput" type="file" accept=".mp3,.wav,audio/mp3,audio/wav" @change="onFileSelected" class="file-input" />
            <button name="upload" class="button" @click="triggerFileUpload" :disabled="state === 'processing'"><UploadIcon />&nbsp;{{ t('transcribe.upload') }} </button>
            <div class="dropzone" :class="{ 'drag-over': isDragOver, 'disabled': state === 'processing' }"
            >
              <AudioWaveformIcon />&nbsp;{{ t('transcribe.dropzone') }}
            </div>
          </div>
        </div>

        <div class="visualizer">
          <CircleIcon v-if="state == 'recording'" class="stop" color="red" fill="red" @click="onStop()" />
          <Loader class="loader" v-else-if="state === 'processing'" />
          <CircleIcon v-else class="record" :color="state === 'initializing' ? 'orange' : 'var(--text-color)'" :fill="state === 'initializing' ? 'orange' : 'var(--background-color)'" @click="onRecord(false)" />
          <Waveform :width="500" :height="32" :foreground-color-inactive="foregroundColorInactive" :foreground-color-active="foregroundColorActive" :audio-recorder="audioRecorder" :is-recording="state == 'recording'"/>
        </div>
        
        <div class="result">
          <textarea v-model="transcription" :placeholder="t('transcribe.clickToRecord') + ' ' + t(pushToTalk ? 'transcribe.spaceKeyHint.pushToTalk' : 'transcribe.spaceKeyHint.toggle')" />
        </div>
        
        <div class="actions">
          <div class="form form-large">
            <button name="summarize" class="button" @click="onSummarize" :disabled="!transcription || state === 'processing'"><MinimizeIcon /> {{ t('transcribe.summarize') }}</button>
            <button name="translate" id="translate-btn" class="button" @click="onTranslate" :disabled="!transcription || state === 'processing'"><GlobeIcon /></button>
            <button name="commands" id="commands-btn" class="button" @click="onCommands" :disabled="!transcription || state === 'processing'"><WandIcon /></button>
            <div class="flex-push"></div>
            <button name="clear" class="button" @click="onClear" :disabled="!transcription || state === 'processing'">{{ t('common.clear') }}</button>
            <button name="insert" class="button" @click="onInsert" :disabled="!transcription || state === 'processing'">{{ t('common.insert') }}</button>
            <button name="copy" class="button" @click="onCopy" :disabled="!transcription || state === 'processing'">{{ copying ? t('common.copied') : t('common.copy') }}</button>
          </div>
        </div>

        <div class="help">
          <div>{{ t('transcribe.help.clear', { shortcut: `${meta}+X` })}}</div>
          <div>{{ t('transcribe.help.copy', { shortcut: `${meta}+C` })}}</div>
          <div>{{ t('transcribe.help.cut', { shortcut: `Shift+${meta}+C` })}}</div>
        </div>

      </main>
    </div>

    <ContextMenuPlus v-if="showTranslateMenu" @close="() => showTranslateMenu = false" :show-filter="true" anchor="#translate-btn" position="above" :teleport="false">
      <div class="item disabled">{{ t('transcribe.translate') }}</div>
      <div v-for="lang in allLanguages" :key="lang.label" class="item" @click="handleTranslateClick(lang.label)">
        {{ lang.label }}
      </div>
    </ContextMenuPlus>

    <ContextMenuPlus v-if="showCommandsMenu" @close="() => showCommandsMenu = false" :show-filter="true" anchor="#commands-btn" position="above" :teleport="false">
      <div v-for="cmd in commandsMenuActions" :key="cmd.action" class="item" @click="handleCommandClick(cmd.action)">
        <span v-if="typeof cmd.icon === 'string'" class="icon text">{{ cmd.icon }}</span>
        <component :is="cmd.icon" v-else-if="typeof cmd.icon === 'object'" class="icon" />
        {{ cmd.label }}
      </div>
    </ContextMenuPlus>

  </div>
</template>

<script setup lang="ts">

import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import ContextMenuPlus from '../components/ContextMenuPlus.vue'
import LangSelect from '../components/LangSelect.vue'
import Loader from '../components/Loader.vue'
import Waveform from '../components/Waveform.vue'
import useAudioRecorder from '../audio/audio_recorder'
import Dialog from '../utils/dialog'
import useTranscriber from '../audio/transcriber'
import Attachment from '../../models/attachment'
import { allLanguages, commandI18n, t } from '../services/i18n'
import { store } from '../services/store'
import { getSTTEngines, getSTTModels, StreamingChunk } from '../voice/stt'

import { AudioWaveformIcon, CircleIcon, DiscIcon, GlobeIcon, MicIcon, MinimizeIcon, UploadIcon, WandIcon } from 'lucide-vue-next'
import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

// init stuff
const { transcriber, processStreamingError } = useTranscriber(store.config)
const audioRecorder = useAudioRecorder(store.config)
let userStoppedDictation = false
let pushToTalkCancelled = false
let pushToTalkMode = false

type State = 'idle'|'initializing'|'recording'|'processing'

const engine = ref('')
const model = ref('')
const locale = ref('')
const pushToTalk = ref(false)
const state = ref<State>('idle')
const transcription = ref('')
const autoStart = ref(false)
const foregroundColorActive = ref('')
const foregroundColorInactive = ref('')
const copying = ref(false)
const fileInput = ref(null)
const showTranslateMenu = ref(false)
const showCommandsMenu = ref(false)
const isDragOver = ref(false)

let previousTranscription = ''

const meta = computed(() => window.api.platform === 'darwin' ? 'Cmd' : 'Ctrl')

const models = computed(() => {
  return getSTTModels(engine.value) ?? []
})

const commandsMenuActions = computed(() => {
  return store.commands.filter((c) => c.state == 'enabled').map(c => {
    return { label: c.label ?? commandI18n(c, 'label'), action: c.id, icon: c.icon }
  })
})

onMounted(async () => {

  // events
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  window.api.on('file-modified', onFileModified)

  // init
  load()

  // when screen is shown
  if (autoStart.value) {
    toggleRecord()
  } else {
    await initializeAudio()
  }

  // grab colors
  try {
    foregroundColorInactive.value = window.getComputedStyle(document.querySelector('.transcribe')).getPropertyValue('color')
    foregroundColorActive.value = window.getComputedStyle(document.querySelector('.visualizer')).getPropertyValue('color')
  } catch (error) {
    if (!process.env.TEST) {
      console.error('Error getting colors:', error)
    }
  }

})

onBeforeUnmount(() => {

  // save
  store.transcribeState = {
    transcription: transcription.value,
  }

  // stop everything
  if (state.value === 'recording') {
    onStop()
  }
  audioRecorder.release()

  // events
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)
  window.api.off('file-modified', onFileModified)
})

const onFileModified = (file: string) => {
  if (file === 'settings') {
    store.transcribeState.transcription = transcription.value
    load()
  }
}

const load = () => {

  pushToTalk.value = store.config.stt.pushToTalk
  autoStart.value = store.config.stt.autoStart
  locale.value = store.config.stt.locale || ''
  engine.value = store.config.stt.engine

  if (!autoStart.value) {
    transcription.value = store.transcribeState.transcription
  }
  
  // Validate that the current model is valid for the selected engine
  const availableModels = getSTTModels(engine.value) ?? []
  const configModel = store.config.stt.model
  
  if (availableModels.find(m => m.id === configModel)) {
    model.value = configModel
  } else if (availableModels.length > 0) {
    // If the stored model is not valid for this engine, use the first available model
    model.value = availableModels[0].id
  } else {
    model.value = ''
  }
  
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
  await transcriber.initialize()
  await initializeAudio()
  if (transcriber.engine) {
    console.log('[stt]', transcriber.engine?.name, transcriber.model)
  }

  // other stuff
  autoStart.value = store.config.stt.autoStart
  pushToTalk.value = store.config.stt.pushToTalk

}

const toggleRecord = () => {
  if (state.value === 'initializing' || state.value === 'processing') {
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

        onRecordingComplete: async (audioBlob: Blob, noiseDetected: boolean) => {

          // if no noise stop everything
          if (!noiseDetected) {
            state.value = 'idle'
            return
          }

          // transcribe
          await transcribe(audioBlob)

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

  // we need to be idle to start recording
  if (state.value !== 'idle') {
    return
  }

  // init
  // console.log('onRecord: push-to-talk=', ptt)
  state.value = 'initializing'

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

  // check
  if (pushToTalkCancelled) {
    pushToTalkCancelled = false
    return
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
    state.value = 'idle'
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
    state.value = 'idle'
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

const transcribe = async (audioBlob: Blob) => {

  try {

    const response = await transcriber.transcribe(audioBlob)

    // add a space if needed
    if (transcription.value.length && ',;.?!'.indexOf(transcription.value[transcription.value.length - 1]) !== -1 && response.text[0] !== ' ') {
      transcription.value += ' '
    }
    transcription.value += response.text

  } catch (error) {
    console.error('Error:', error)
    Dialog.alert(t('transcribe.errors.transcription'), error.message)
  } finally {
    state.value = 'idle'
  }

}

const onKeyDown = (event: KeyboardEvent) => {

  // modifiers
  const isCommand = !event.shiftKey && !event.altKey && (event.metaKey || event.ctrlKey)
  const isShiftCommand = event.shiftKey && !event.altKey && (event.metaKey || event.ctrlKey)

  // check if focus is on a textarea
  let isTextAreaFocused = false
  let isTextAreaSelected = false
  if ((event.target as HTMLElement).nodeName === 'TEXTAREA') {
    isTextAreaFocused = true
    const textarea = event.target as HTMLTextAreaElement
    if (textarea.selectionStart !== textarea.selectionEnd) {
      isTextAreaSelected = true
    }
  }

  // process
  if (event.code === 'Space' && !isTextAreaFocused) {
    if (state.value !== 'recording') {
      onRecord(pushToTalk.value)
    } else if (!pushToTalk.value) {
      onStop()
    }
  } else if (isCommand && event.key === 'Enter') {
    event.preventDefault()
    onInsert()
  } else if (isCommand && event.key === 'x' && !isTextAreaSelected) {
    onClear()
  } else if (isCommand && event.key === 'c' && !isTextAreaSelected) {
    onCopy()
  } else if (isCommand && event.key === 'i') {
    onInsert()
  } else if (isShiftCommand && event.key.toLocaleLowerCase() === 'c') {
    if (onCopy()) {
      window.api.main.close()
    }
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
    } else if (pushToTalk.value) {
      pushToTalkCancelled = true
    }
  }
}

const onClear = () => {
  transcription.value = ''
  refocus()
}

const onCopy = () => {
  window.api.clipboard.writeText(transcription.value)
  if (window.api.clipboard.readText() != transcription.value) {
    Dialog.alert(t('transcribe.errors.copy'))
    return false
  } else {
    copying.value = true
    setTimeout(() => {
      copying.value = false
    }, 2000)
  }
  return true
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

const triggerFileUpload = () => {
  fileInput.value?.click()
}

const onFileSelected = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return
  const file = files[0]
  await processAudioFile(file)
  target.value = ''
}

const onDragOver = (event: DragEvent) => {
  if (state.value === 'processing') return
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'copy'
}

const onDragEnter = (event: DragEvent) => {
  if (state.value === 'processing') return
  event.preventDefault()
  isDragOver.value = true
}

const onDragLeave = (event: DragEvent) => {
  if (state.value === 'processing') return
  event.preventDefault()
  // Only set to false if we're leaving the dropzone itself, not a child element
  if (!(event.currentTarget as HTMLElement)?.contains(event.relatedTarget as Node)) {
    // for a very strange reason, when dragging over the textarea, the relatedTarget is a div with no parent and no children
    const relatedTarget = event.relatedTarget as HTMLElement
    if (relatedTarget && relatedTarget.nodeName === 'DIV' && relatedTarget.parentElement === null && relatedTarget.children.length === 0) {
      return
    }
    isDragOver.value = false
  }
}

const onDrop = async (event: DragEvent) => {
  if (state.value === 'processing') return
  
  event.preventDefault()
  isDragOver.value = false
  
  const files = event.dataTransfer?.files
  if (!files || files.length === 0) return
  
  const file = files[0]
  
  // Check if it's an audio file
  const validTypes = ['audio/mp3', 'audio/wav', 'audio/mpeg', 'audio/wave']
  const validExtensions = ['.mp3', '.wav']
  const isValidType = validTypes.includes(file.type) || 
                     validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
  
  if (!isValidType) {
    Dialog.alert(t('transcribe.errors.invalidFileType'))
    return
  }
  
  // Process the file using the same logic as onFileSelected
  await processAudioFile(file)
}

const processAudioFile = async (file: File) => {
  try {
    state.value = 'processing'
    await transcriber.initialize()
    const response = await transcriber.transcribeFile(file)
    if (transcription.value.length && ',;.?!'.indexOf(transcription.value[transcription.value.length - 1]) === -1) {
      transcription.value += ' '
    }
    transcription.value += response.text
    
  } catch (error) {
    console.error('Error transcribing file:', error)
    Dialog.alert(t('transcribe.errors.transcription'), `${file.name}: ${error.message}`)
  } finally {
    state.value = 'idle'
  }
}

const onSummarize = async () => {
  emitEvent('new-chat', {
    prompt: t('transcribe.summarizePrompt'),
    attachments: [ new Attachment(window.api.base64.encode(transcription.value), 'text/plain','' ) ],
    submit: true,
  })
}

const onTranslate = async () => {
  showTranslateMenu.value = true
}

const handleTranslateClick = async (action: string) => {
  showTranslateMenu.value = false
  if (!action) return
  const lang = action.split(' ').slice(1).join(' ')
  emitEvent('new-chat', {
    prompt: t('transcribe.translatePrompt', { lang }),
    attachments: [ new Attachment(window.api.base64.encode(transcription.value), 'text/plain','' ) ],
    submit: true,
  })
}

const onCommands = async () => {
  showCommandsMenu.value = true
}

const handleCommandClick = async (action: string) => {
  showTranslateMenu.value = false
  if (!action) return
  const command = store.commands.find(c => c.id === action)
  if (!command) return
  emitEvent('new-chat', {
    prompt: commandI18n(command, 'template').replace('{input}', transcription.value),
    submit: action !== window.api.commands.askMeAnythingId(),
  })
}

defineExpose({
  startDictation: toggleRecord,
})

</script>


<style scoped>

button {
  svg {
    position: relative;
    top: 1.5px;
  }
}

.transcribe {

  .sp-sidebar {
    flex: 0 0 var(--large-panel-width);
  }

  .sp-main {

    main {

      padding: 10% 1rem;
      align-items: stretch;
      margin: 0 auto;
      width: 600px;

      .controls {
        margin-bottom: 3rem;
        
        .form {
          display: flex;
          flex-direction: row;
          justify-content: center;
          align-items: center;
          gap: 12px;

          > * {
            flex: 1;
            white-space: nowrap;
          }

          .file-input {
            display: none;
          }
            
          .dropzone {
            padding: 0.39rem 0.75rem;
            border: 1px dashed var(--control-border-color);
            border-radius: var(--control-button-border-radius);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--control-text-color);
            background-color: var(--control-bg-color);
            
            &.drag-over {
              border-color: var(--highlight-color);
              background-color: var(--highlight-color);
              color: white;
            }
            
            &.disabled {
              cursor: not-allowed;
              color: var(--control-button-disabled-text-color);
              border-color: var(--control-button-disabled-border-color);
              background-color: var(--control-button-disabled-bg-color);
            }
            
          }

        }
      }

      .visualizer {
        margin-left: 8px;
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        font-size: 24px;
        gap: 24px;
        align-items: center;
        color: var(--text-color);

        .loader {
          margin: 8px 0px 8px 6px;
          background-color: orange;
        }

      }
      
      .result {
        flex: 1;
        display: flex;
        margin-top: 16px;
        
        textarea {
          flex: 1;
          background-color: var(--control-textarea-bg-color);
          border: 0.25px solid var(--control-border-color);
          color: var(--text-color);
          border-radius: 6px;
          font-size: 15.5px;
          padding: 8px;
          resize: none;

          &::placeholder {
            padding: 32px;
            position: relative !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
            text-align: center;
            line-height: 140%;
            font-family: var(--font-family-serif);
            font-size: 18.5px;
          }
        }

        .transcription-display {
          flex: 1;
          background-color: var(--control-textarea-bg-color);
          border: 0.25px solid var(--control-border-color);
          color: var(--text-color);
          border-radius: 6px;
          font-size: 15.5px;
          padding: 8px;
          min-height: 200px;
          overflow-y: auto;

          .final-text {
            color: var(--text-color);
            line-height: 1.4;
          }
        }
      }


      .actions {
        
        margin-top: 1rem;

        .form {
          display: flex;
          flex-direction: row;
        }

      }

      .help {
        margin-top: 0.5rem;
        font-size: 13.5px;
        text-align: right;
      }

    }

  }

}

</style>