<template>
  <div>
    <div class="group">
      <label>Engine</label>
      <select v-model="engine" @change="onChangeEngine">
        <option v-for="engine in engines" :key="engine.id" :value="engine.id">
          {{ engine.label }}
        </option>
      </select>
    </div>
    <div class="group">
      <label>Model</label>
      <div class="subgroup">
        <select v-model="model" @change="onChangeModel">
          <option v-for="model in models" :key="model.id" :value="model.id">
            {{ model.label }}
          </option>
        </select>
        <div class="progress" v-if="progress">{{ progressText }}
        </div>
      </div>
    </div>
    <div class="group">
      <label>Silence Detection</label>
      <select v-model="duration" @change="save">
        <option value="0">Disabled</option>
        <option value="1000">1 second</option>
        <option value="2000">2 seconds</option>
        <option value="3000">3 seconds</option>
        <option value="4000">4 seconds</option>
        <option value="5000">5 seconds</option>
      </select>
    </div>
    <div class="group">
      <label>Silence Action<br/>(depends on context)</label>
      <select v-model="action" @change="save">
        <option value="nothing">Continue recording</option>
        <option value="stop_transcribe">Stop recording and transcribe</option>
        <option value="stop_execute">Stop recording and execute</option>
        <option value="execute_continue">Execute and continue recording</option>
      </select>
    </div>
    <div class="group">
      <label></label>
      <button @click.prevent="deleteLocalModels">Delete all models stored locally</button>
    </div>
    <div class="group" v-if="engine === 'openai'">
      <label></label>
      <span>Make sure you enter your OpenAI API key in the Models pane.</span>
    </div>
    <div class="group" v-if="engine === 'groq'">
      <label></label>
      <span>Make sure you enter your Groq API key in the Models pane.</span>
    </div>
  </div>
</template>

<script setup>

import { ref, computed } from 'vue'
import { store } from '../services/store'
import Swal from 'sweetalert2/dist/sweetalert2.js'
import getSTTEngine from '../services/stt'
import STTOpenAI from '../services/stt-openai'
import STTGroq from '../services/stt-groq'
import STTWhisper from '../services/stt-whisper'

const engine = ref('openai')
const model = ref('whisper-1')
const duration = ref(null)
const progress = ref(null)
const action = ref(null)

let previousEngine = null
let previousModel = null

const engines = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'groq', label: 'Groq' },
  { id: 'whisper', label: 'Whisper' },
]

const models = computed(() => {
  if (engine.value === 'openai') {
    return STTOpenAI.models
  } else if (engine.value === 'groq') {
    return STTGroq.models
  } else if (engine.value === 'whisper') {
    return STTWhisper.models
  }
})

const progressText = computed(() => {
  if (Object.keys(progress.value).length === 0) {
    return 'Initializing...'
  } else if (progress.value.status === 'ready') {
    return 'Download completed!'
  }
  const loadedTotal = Object.values(progress.value).reduce((acc, p) => {
    acc.loaded += p.loaded
    acc.total += p.total
    return acc
  }, { loaded: 0, total: 0 })
  return `Downloading: ${Math.floor(loadedTotal.loaded / loadedTotal.total * 100)}%`
})

const load = () => {
  const detection = store.config.stt.silenceDetection
  duration.value = detection ? store.config.stt.silenceDuration || 2000 : 0
  engine.value = store.config.stt.engine || 'openai'
  model.value = store.config.stt.model || 'whisper-1'
  action.value = store.config.stt.silenceAction || 'stop_transcribe'
}

const save = () => {
  store.config.stt.silenceDetection = (duration.value != 0)
  store.config.stt.silenceDuration = parseInt(duration.value)
  store.config.stt.silenceAction = action.value
  store.saveSettings()
}

const onChangeEngine = () => {
  previousEngine = `${store.config.stt.engine}`
  model.value = models.value[0].id
  onChangeModel()
}

const onChangeModel = () => {
  previousModel = `${store.config.stt.model}`
  store.config.stt.engine = engine.value
  store.config.stt.model = model.value
  const sttEngine = getSTTEngine(store.config)
  if (sttEngine.requiresDownload()) {
    Swal.fire({
      target: document.querySelector('.settings .voice'),
      title: 'This engine needs to be configured first! Do you want to open the Settings?',
      confirmButtonText: 'Configure',
      showCancelButton: true,
    }).then((result) => {
      if (result.isConfirmed) {
        initializeEngine(sttEngine)
      } else {
        store.config.stt.engine = previousEngine
        store.config.stt.model = previousModel
        engine.value = previousEngine
        model.value = previousModel
      }
    })
  } else {
    initializeEngine(sttEngine)
  }
}

const initializeEngine = async (engine) => {

  // init progress if download required
  progress.value = engine.requiresDownload() ? {} : null

  // initialize
  engine.initialize((data) => {

    // error
    if (data.status === 'error') {
      alert('An error occured during initialization. Please try again.')
      engine.deleteModel(model.value)
      store.config.stt.engine = previousEngine
      store.config.stt.model = previousModel
      engine.value = previousEngine
      model.value = previousModel
      progress.value = null
    }

    // initialization completed
    if (data.status === 'ready') {

      // notify user
      if (engine.requiresDownload()) {
        progress.value = data
        setTimeout(() => {
          progress.value = null
        }, 2000)
      }

      // save settings
      store.saveSettings()
    }

    // progress but only if we know the file size
    if (data.status === 'progress') {
      if (data.total !== 0) {
        progress.value[data.file] = data
      }
    }

  })
}

const deleteLocalModels = async () => {
  Swal.fire({
    target: document.querySelector('.settings .voice'),
    title: 'You will have to download all local models again.',
    confirmButtonText: 'Delete',
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      for (const engineName of ['Xenova/']) {
        const engine = getSTTEngine({ stt: { model: engineName } })
        engine.deleteAllModels()
      }
    }
  })
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>

<style scoped>
.progress {
  margin-top: 8px;
}
</style>
