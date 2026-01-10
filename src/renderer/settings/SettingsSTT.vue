<template>
  <div class="form form-vertical form-large">
    
    <div class="form-field language">
      <label>{{ t('settings.voice.spokenLanguage') }}</label>
      <LangSelect v-model="locale" default-text="settings.voice.automatic" @change="save" />
    </div>
    
    <div class="form-field vocabulary">
      <label>{{ t('settings.voice.customVocabulary.label') }}</label>
      <textarea v-model="vocabulary" name="vocabulary" @change="save" :placeholder="t('settings.voice.customVocabulary.placeholder')"></textarea>
    </div>
    
    <div class="form-field">
      <label>{{ t('settings.voice.engine') }}</label>
      <select name="engine" v-model="engine" @change="onChangeEngine">
        <option v-for="engine in getSTTEngines()" :key="engine.id" :value="engine.id">
          {{ engine.label }}
        </option>
      </select>
    </div>
    
    <span v-if="engine === 'openai'">{{ t('settings.voice.openaiApiKeyReminder') }}</span>
    <span v-if="engine === 'groq'">{{ t('settings.voice.groqApiKeyReminder') }}</span>
    <span v-if="engine === 'mistralai'">{{ t('settings.voice.mistralApiKeyReminder') }}</span>
    <span v-if="engine === 'apple'">{{ t('settings.voice.appleRequiresMacOS26') }}</span>
  
    <div class="form-field" v-if="engine == 'falai'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="falAiAPIKey" @blur="save" />
    </div>
    
    <div class="form-field" v-if="engine == 'fireworks'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="fireworksAPIKey" @blur="save" />
    </div>
    
    <div class="form-field" v-if="engine == 'speechmatics'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="speechmaticsAPIKey" @blur="save" />
    </div>
    
    <div class="form-field" v-if="engine == 'huggingface'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="huggingFaceAPIKey" @blur="save" />
    </div>
    
    <div class="form-field" v-if="engine == 'gladia'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="gladiaAPIKey" @blur="save" />
    </div>
    
    <div class="form-field" v-if="engine == 'nvidia'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="nvidiaAPIKey" @blur="save" />
    </div>
    
    <div class="form-field" v-if="engine == 'soniox'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="sonioxAPIKey" @blur="save" />
    </div>
    
    <div class="form-field horizontal" v-if="engine == 'whisper'">
      <input type="checkbox" id="whisper-gpu" v-model="whisperGPU" @change="save" />
      <label for="whisper-gpu">{{ t('settings.voice.useWebGpu') }}</label>
    </div>

    <div class="form-field horizontal" v-if="engine == 'parakeet'">
      <input type="checkbox" id="parakeet-gpu" v-model="parakeetGPU" @change="save" />
      <label for="parakeet-gpu">{{ t('settings.voice.useWebGpu') }}</label>
    </div>

    <div class="form-field" v-if="engine != 'custom'">
      <label>{{ t('settings.voice.model') }}</label>
      <div class="form-subgroup">
        <select name="model" v-model="model" @change="onChangeModel">
          <option v-for="model in models" :key="model.id" :value="model.id">
            {{ model.label }}
          </option>
        </select>
        <div class="progress" v-if="progress">{{ progressText }}
        </div>
      </div>
    </div>
    
    <template v-else>
      
      <div class="form-field">
        <label>{{ t('settings.engines.apiBaseURL') }}</label>
        <input name="baseURL" v-model="baseURL" :placeholder="defaults.engines.openai.baseURL" @change="save"/>
      </div>
      <div class="form-field">
        <label>{{ t('settings.voice.model') }}</label>
        <input name="model" v-model="model" @change="onChangeModel"/>
      </div>
    
    </template>
    
    <div class="form-field" v-if="engine == 'nvidia'">
      <label>{{ t('common.prompt') }}</label>
      <textarea v-model="nvidiaPrompt" @blur="save" />
    </div>
    
    <div class="form-field" v-if="engine == 'mistralai' && (!model.includes('transcribe'))">
      <label>{{ t('common.prompt') }}</label>
      <textarea v-model="mistralPrompt" @blur="save" />
    </div>
    
    <div class="form-field horizontal" v-if="engine == 'soniox'">
      <input type="checkbox" id="soniox-cleanup" v-model="sonioxCleanup" @change="save" />
      <label for="soniox-cleanup">{{ t('settings.voice.soniox.cleanup') }}</label>
    </div>

    <div class="form-field">
      <label>{{ t('settings.voice.silenceDetection') }}</label>
      <select name="duration" v-model="duration" @change="save">
        <option value="0">{{ t('settings.voice.silenceOptions.disabled') }}</option>
        <option value="1000">{{ t('settings.voice.silenceOptions.oneSecond') }}</option>
        <option value="2000">{{ t('settings.voice.silenceOptions.twoSeconds') }}</option>
        <option value="3000">{{ t('settings.voice.silenceOptions.threeSeconds') }}</option>
        <option value="4000">{{ t('settings.voice.silenceOptions.fourSeconds') }}</option>
        <option value="5000">{{ t('settings.voice.silenceOptions.fiveSeconds') }}</option>
      </select>
    </div>
    
    <!-- <div class="form-field">
      <label>Silence Action<br/>(depends on context)</label>
      <select v-model="action" @change="save">
        <option value="nothing">Continue recording</option>
        <option value="stop_transcribe">Stop recording and transcribe</option>
        <option value="stop_execute">Stop recording and execute</option>
        <option value="execute_continue">Execute and continue recording</option>
      </select>
    </div> -->
    
    <div class="form-field test-area">
      <label>{{ t('settings.voice.test') }}</label>
      <div class="test-input">
        <textarea class="test-result" v-model="testResult" readonly rows="2" :placeholder="t('settings.voice.testPlaceholder')"></textarea>
        <div class="test-controls">
          <Waveform
            v-if="isRecording"
            :width="32"
            :height="12"
            foreground-color-inactive="var(--control-placeholder-text-color)"
            foreground-color-active="red"
            :audio-recorder="voiceRecording.audioRecorder"
            :is-recording="true"
          />
          <ButtonIcon @click.prevent="toggleTest" :disabled="!canTest">
            <SpinningIcon v-if="isProcessing" :spinning="true" />
            <MicIcon v-else :class="{ recording: isRecording }" />
          </ButtonIcon>
        </div>
      </div>
    </div>

    <div class="form-field" v-if="requiresDownload(engine)">
      <label></label>
      <button @click.prevent="deleteLocalModels">{{ t('settings.voice.deleteLocalModels') }}</button>
    </div>

  </div>
</template>

<script setup lang="ts">

import { Configuration } from 'types/config'
import { ref, computed, onBeforeUnmount } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'
import defaults from '@root/defaults/settings.json'
import InputObfuscated from '@components/InputObfuscated.vue'
import { getSTTEngines, getSTTEngine, getSTTModels, requiresDownload, isSTTReady, ProgressInfo, DownloadProgress, STTEngine, TaskStatus } from '../voice/stt'
import Dialog from '@renderer/utils/dialog'
import LangSelect from '@components/LangSelect.vue'
import useVoiceRecording from '@renderer/audio/voice_recording'
import Waveform from '@components/Waveform.vue'
import ButtonIcon from '@components/ButtonIcon.vue'
import SpinningIcon from '@components/SpinningIcon.vue'
import { MicIcon } from 'lucide-vue-next'

type InitModelMode = 'download' | 'verify'
let initMode: InitModelMode = 'download'

type FilesProgressInfo = { [key: string]: DownloadProgress }

const locale = ref('')
const vocabulary = ref('')
const engine = ref('openai')
const model = ref('')
const falAiAPIKey = ref(null)
const fireworksAPIKey = ref(null)
const gladiaAPIKey = ref(null)
const huggingFaceAPIKey = ref(null)
const speechmaticsAPIKey = ref(null)
const sonioxAPIKey = ref(null)
const sonioxCleanup = ref(false)
const nvidiaAPIKey = ref(null)
const nvidiaPrompt = ref(null)
const mistralPrompt = ref(null)
const whisperGPU = ref(true)
const parakeetGPU = ref(false)
const baseURL = ref('')
const duration = ref(null)
const progress= ref<FilesProgressInfo|TaskStatus>(null)
//const action = ref(null)

// test recording
const testResult = ref('')
const voiceRecording = useVoiceRecording({
  onTranscriptionComplete: (text: string) => {
    testResult.value = text
  },
  onTranscriptionChunk: (text: string) => {
    testResult.value = text
  },
  autoStopOnSilence: true,
})

const isRecording = computed(() => voiceRecording.state.value === 'recording')
const isProcessing = computed(() => voiceRecording.state.value === 'processing')
const canTest = computed(() => {
  // local engines don't need API keys
  if (engine.value === 'whisper' || engine.value === 'parakeet' || engine.value === 'apple') {
    return model.value?.length > 0
  }
  return isSTTReady(store.config)
})

const models = computed(() => {

  // get models
  const models = getSTTModels(engine.value)

  // add a dummy one if download is required
  return [
    ...(requiresDownload(engine.value) ? [{ id: '', label: t('settings.voice.selectModel') }] : []),
    ...models
  ]

})

const progressText = computed(() => {
  if (Object.keys(progress.value).length === 0) {
    return t('settings.voice.initializing')
  } else if (progress.value.status === 'ready') {
    return initMode === 'download' ? t('settings.voice.downloadComplete') : t('settings.voice.verificationComplete')
  }
  const loadedTotal = Object.values(progress.value).reduce((acc, p) => {
    acc.loaded += p.loaded
    acc.total += p.total
    return acc
  }, { loaded: 0, total: 0 })
  
  const percent = Math.floor(loadedTotal.loaded / loadedTotal.total * 100)
  return initMode === 'download' 
    ? t('settings.voice.downloading', { percent }) 
    : t('settings.voice.verifying', { percent })
})

const load = () => {
  const detection = store.config.stt.silenceDetection
  duration.value = detection ? store.config.stt.silenceDuration || 2000 : 0
  vocabulary.value = store.config.stt.vocabulary.map(v => v.text).join('\n') || ''
  locale.value = store.config.stt.locale || ''
  engine.value = store.config.stt.engine || 'openai'
  model.value = store.config.stt.model || ''
  falAiAPIKey.value = store.config.engines.falai.apiKey || null
  fireworksAPIKey.value = store.config.engines.fireworks.apiKey || null
  gladiaAPIKey.value = store.config.engines.gladia.apiKey || null
  speechmaticsAPIKey.value = store.config.engines.speechmatics.apiKey || null
  huggingFaceAPIKey.value = store.config.engines.huggingface.apiKey || null
  sonioxAPIKey.value = store.config.engines.soniox?.apiKey || null
  sonioxCleanup.value = store.config.stt.soniox?.cleanup ?? false
  baseURL.value = store.config.stt.customOpenAI.baseURL || ''
  nvidiaAPIKey.value = store.config.engines.nvidia?.apiKey || null
  nvidiaPrompt.value = store.config.stt.nvidia?.prompt || null
  mistralPrompt.value = store.config.stt.mistralai?.prompt || null
  whisperGPU.value = store.config.stt.whisper.gpu ?? true
  parakeetGPU.value = store.config.stt.parakeet?.gpu ?? false
  // action.value = store.config.stt.silenceAction || 'stop_transcribe'
}

const save = () => {
  store.config.stt.locale = locale.value
  store.config.stt.vocabulary = vocabulary.value.split('\n').filter(line => line.trim().length > 0).map(line => ({ text: line.trim() }))
  store.config.stt.silenceDetection = (duration.value != 0)
  store.config.stt.silenceDuration = parseInt(duration.value)
  store.config.engines.falai.apiKey = falAiAPIKey.value
  store.config.engines.fireworks.apiKey = fireworksAPIKey.value
  store.config.engines.gladia.apiKey = gladiaAPIKey.value
  store.config.engines.speechmatics.apiKey = speechmaticsAPIKey.value
  store.config.engines.huggingface.apiKey = huggingFaceAPIKey.value
  store.config.engines.nvidia.apiKey = nvidiaAPIKey.value
  store.config.engines.soniox.apiKey = sonioxAPIKey.value
  store.config.stt.soniox.cleanup = sonioxCleanup.value
  store.config.stt.customOpenAI.baseURL = baseURL.value
  store.config.stt.nvidia.prompt = nvidiaPrompt.value
  store.config.stt.mistralai.prompt = mistralPrompt.value
  store.config.stt.whisper.gpu = whisperGPU.value
  store.config.stt.parakeet.gpu = parakeetGPU.value
  //store.config.stt.silenceAction = action.value
  store.saveSettings()
}

const onChangeEngine = () => {
  model.value = models.value.length ? models.value[0].id : ''
  onChangeModel()
}

const onChangeModel = async () => {

  // // dummy selector
  // if (engine.value !== 'custom' && model.value === '') {
  //   return
  // }

  // save engine and model
  const saveConfig = () => {
    store.config.stt.engine = engine.value
    store.config.stt.model = model.value
    store.saveSettings()
  }

  // confirmed callback
  const changeEngine = () => {

    // save settings
    saveConfig()

    // do it
    const sttEngine = getSTTEngine(store.config)
    initializeEngine(sttEngine)
  }

  // if no download required easy:
  if (!requiresDownload(engine.value)) {
    changeEngine()
    return
  }

  // if dummy selector
  if (model.value === '') {
    saveConfig()
    return
  }

  // check if download is required
  const sttEngine = getSTTEngine(store.config)
  if (await sttEngine.isModelDownloaded(model.value)) {
    initMode = 'verify'
    changeEngine()
    return
  }
  
  // show dialog
  Dialog.show({
    target: document.querySelector('.settings .voice'),
    title: t('settings.voice.downloadConfirmation.title'),
    confirmButtonText: t('common.yes'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      initMode = 'download'
      changeEngine()
    } else {
      model.value = ''
    }
  })
}

const initializeEngine = async (sttEngine: STTEngine) => {

  // init progress if download required
  progress.value = sttEngine.requiresDownload() ? {} : null

  // initialize
  sttEngine.initialize((data: ProgressInfo) => {

    // debug
    //console.log(data)
    
    // cast
    const taskStatus = data as TaskStatus
    const dowloadProgress = data as DownloadProgress

    // error
    if (taskStatus.status === 'error') {
      Dialog.alert(t('settings.voice.initializationError'))
      sttEngine.deleteModel(model.value)
      progress.value = null
      model.value = ''
    }

    // initialization completed
    if (taskStatus.status === 'ready') {

      // notify user
      if (sttEngine.requiresDownload()) {
        progress.value = taskStatus
        setTimeout(() => {
          progress.value = null
        }, 2000)
      }

      // save settings
      store.saveSettings()
    }

    // progress but only if we know the file size
    if (dowloadProgress.status === 'progress') {
      if (dowloadProgress.total !== 0) {
        const filesProgressInfo = progress.value as FilesProgressInfo
        filesProgressInfo[dowloadProgress.file] = dowloadProgress
      }
    }

  })
}

const deleteLocalModels = async () => {
  Dialog.show({
    target: document.querySelector('.settings .voice'),
    title: t('settings.voice.deleteConfirmation.title'),
    text: t('settings.voice.deleteConfirmation.text'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      for (const engineName of ['Xenova/']) {
        const engine = getSTTEngine({ stt: { model: engineName } } as Configuration)
        engine.deleteAllModels()
      }
    }
    if (engine.value === 'whisper' || engine.value === 'parakeet') {
      model.value = ''
    }
  })
}

const toggleTest = async () => {
  if (isRecording.value) {
    voiceRecording.stopRecording()
  } else {
    testResult.value = ''
    voiceRecording.startRecording()
  }
}

onBeforeUnmount(() => {
  if (isRecording.value) {
    voiceRecording.stopRecording()
  }
})

defineExpose({ load })

</script>

<style scoped>

.progress {
  margin-top: 8px;
}

.settings .form.form-vertical .form-field textarea {
  flex: 1 0 100px;
}

.test-input {
  width: 100%;
  display: flex;
  align-items: center;
  border: 1px solid var(--control-border-color);
  border-radius: var(--control-border-radius);
  background-color: var(--control-bg-color);
}

.test-result {
  flex: 1;
  height: 1lh;
  resize: none;
  border: none;
  background: transparent;
}

.test-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.test-controls svg.recording {
  color: red;
}

</style>
