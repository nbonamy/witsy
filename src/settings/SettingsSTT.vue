<template>
  <div>
    <div class="group language">
      <label>{{ t('settings.voice.spokenLanguage') }}</label>
      <LangSelect v-model="locale" default-text="settings.voice.automatic" @change="save" />
    </div>
    <div class="group">
      <label>{{ t('settings.voice.engine') }}</label>
      <select name="engine" v-model="engine" @change="onChangeEngine">
        <option v-for="engine in engines()" :key="engine.id" :value="engine.id">
          {{ engine.label }}
        </option>
      </select>
    </div>
    <div class="group" v-if="engine == 'falai'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="falAiAPIKey" @blur="save" />
    </div>
    <div class="group" v-if="engine == 'fireworks'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="fireworksAPIKey" @blur="save" />
    </div>
    <div class="group" v-if="engine == 'huggingface'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="huggingFaceAPIKey" @blur="save" />
    </div>
    <div class="group" v-if="engine == 'gladia'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="gladiaAPIKey" @blur="save" />
    </div>
    <div class="group" v-if="engine == 'nvidia'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="nvidiaAPIKey" @blur="save" />
    </div>
    <div class="group" v-if="engine == 'nvidia'">
      <label>{{ t('common.prompt') }}</label>
      <textarea v-model="nvidiaPrompt" @blur="save" />
    </div>
    <div class="group horizontal" v-if="engine == 'whisper'">
      <input type="checkbox" v-model="whisperGPU" @change="save" />
      <label>{{ t('settings.voice.useWebGpu') }}</label>
    </div>
    <div class="group">
      <label>{{ t('settings.voice.model') }}</label>
      <div class="subgroup">
        <select name="model" v-model="model" @change="onChangeModel">
          <option v-for="model in models" :key="model.id" :value="model.id">
            {{ model.label }}
          </option>
        </select>
        <div class="progress" v-if="progress">{{ progressText }}
        </div>
      </div>
    </div>
    <div class="group">
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
    <!-- <div class="group">
      <label>Silence Action<br/>(depends on context)</label>
      <select v-model="action" @change="save">
        <option value="nothing">Continue recording</option>
        <option value="stop_transcribe">Stop recording and transcribe</option>
        <option value="stop_execute">Stop recording and execute</option>
        <option value="execute_continue">Execute and continue recording</option>
      </select>
    </div> -->
    <div class="group">
      <label></label>
      <button @click.prevent="deleteLocalModels">{{ t('settings.voice.deleteLocalModels') }}</button>
    </div>
    <div class="group" v-if="engine === 'openai'">
      <label></label>
      <span>{{ t('settings.voice.openaiApiKeyReminder') }}</span>
    </div>
    <div class="group" v-if="engine === 'groq'">
      <label></label>
      <span>{{ t('settings.voice.groqApiKeyReminder') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">

import { Configuration } from '../types/config'
import { Ref, ref, computed } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import InputObfuscated from '../components/InputObfuscated.vue'
import getSTTEngine, { requiresDownload, ProgressInfo, DownloadProgress, STTEngine, TaskStatus } from '../voice/stt'
import Dialog from '../composables/dialog'
import LangSelect from '../components/LangSelect.vue'
import STTFalAi from '../voice/stt-falai'
import STTFireworks from '../voice/stt-fireworks'
import STTGladia from '../voice/stt-gladia'
import STTGroq from '../voice/stt-groq'
import STTHuggingFace from '../voice/stt-huggingface'
import STTNvidia from '../voice/stt-nvidia'
import STTOpenAI from '../voice/stt-openai'
import STTWhisper from '../voice/stt-whisper'

type InitModelMode = 'download' | 'verify'
let initMode: InitModelMode = 'download'

type FilesProgressInfo = { [key: string]: DownloadProgress }

const locale = ref('')
const engine = ref('openai')
const model = ref('whisper-1')
const falAiAPIKey = ref(null)
const fireworksAPIKey = ref(null)
const gladiaAPIKey = ref(null)
const huggingFaceAPIKey = ref(null)
const nvidiaAPIKey = ref(null)
const nvidiaPrompt = ref(null)
const whisperGPU = ref(true)
const duration = ref(null)
const progress: Ref<FilesProgressInfo|TaskStatus> = ref(null)
//const action = ref(null)

const engines = () => [
  { id: 'openai', label: 'OpenAI' },
  { id: 'falai', label: 'fal.ai' },
  { id: 'fireworks', label: 'Fireworks.ai' },
  { id: 'gladia', label: 'Gladia' },
  { id: 'groq', label: 'Groq' },
  //{ id: 'huggingface', label: 'Hugging Face' },
  { id: 'nvidia', label: 'nVidia' },
  { id: 'whisper', label: 'Whisper' },
]

const models = computed(() => {

  // get models
  const models = (() => {
    if (engine.value === 'openai') {
      return STTOpenAI.models
    } else if (engine.value === 'falai') {
      return STTFalAi.models
    } else if (engine.value === 'fireworks') {
      return STTFireworks.models
    } else if (engine.value === 'gladia') {
      return STTGladia.models
    } else if (engine.value === 'groq') {
      return STTGroq.models
    } else if (engine.value === 'huggingface') {
      return STTHuggingFace.models
    } else if (engine.value === 'nvidia') {
      return STTNvidia.models
    } else if (engine.value === 'whisper') {
      return STTWhisper.models
    }
  })()

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
  locale.value = store.config.stt.locale || ''
  engine.value = store.config.stt.engine || 'openai'
  model.value = store.config.stt.model || 'whisper-1'
  falAiAPIKey.value = store.config.engines.falai.apiKey || null
  fireworksAPIKey.value = store.config.engines.fireworks.apiKey || null
  gladiaAPIKey.value = store.config.engines.gladia.apiKey || null
  huggingFaceAPIKey.value = store.config.engines.huggingface.apiKey || null
  nvidiaAPIKey.value = store.config.engines.nvidia?.apiKey || null
  nvidiaPrompt.value = store.config.stt.nvidia?.prompt || null
  whisperGPU.value = store.config.stt.whisper.gpu ?? true
  // action.value = store.config.stt.silenceAction || 'stop_transcribe'
}

const save = () => {
  store.config.stt.locale = locale.value
  store.config.stt.silenceDetection = (duration.value != 0)
  store.config.stt.silenceDuration = parseInt(duration.value)
  store.config.engines.falai.apiKey = falAiAPIKey.value
  store.config.engines.fireworks.apiKey = fireworksAPIKey.value
  store.config.engines.gladia.apiKey = gladiaAPIKey.value
  store.config.engines.huggingface.apiKey = huggingFaceAPIKey.value
  store.config.engines.nvidia.apiKey = nvidiaAPIKey.value
  store.config.stt.nvidia.prompt = nvidiaPrompt.value
  store.config.stt.whisper.gpu = whisperGPU.value
  //store.config.stt.silenceAction = action.value
  store.saveSettings()
}

const onChangeEngine = () => {
  model.value = models.value[0].id
  onChangeModel()
}

const onChangeModel = async () => {

  // dummy selector
  if (model.value === '') {
    return
  }

  // confirmed callback
  const changeEngine = () => {

    // save settings
    store.config.stt.engine = engine.value
    store.config.stt.model = model.value
    store.saveSettings()

    // do it
    const sttEngine = getSTTEngine(store.config)
    initializeEngine(sttEngine)
  }

  // if no download required easy:
  if (!requiresDownload(engine.value)) {
    changeEngine()
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
    confirmButtonText: t('common.continue'),
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
    if (engine.value === 'whisper') {
      model.value = ''
    }
  })
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>

<style scoped>
.progress {
  margin-top: 8px;
}
.settings form.vertical .group textarea {
  flex: 1 0 100px;
}
</style>
