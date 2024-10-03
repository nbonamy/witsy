<template>
  <div>
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
      <label></label>
      <button @click.prevent="deleteLocalModels">Delete all models stored locally</button>
    </div>
    <div class="group" v-if="model.startsWith('openai')">
      <label></label>
      <span>Make sure you enter your OpenAI API key in the Models pane.</span>
    </div>
  </div>
</template>

<script setup>

import { ref, computed } from 'vue'
import { store } from '../services/store'
import Swal from 'sweetalert2/dist/sweetalert2.js'
import getSTTEngine from '../services/stt'

const model = ref('openai/whisper-1')
const duration = ref(null)
const progress = ref(null)

let previoousModel = null

const models = [
  { id: 'openai/whisper-1', label: 'OpenAI Whisper V2 (online)' },
  { id: 'Xenova/whisper-tiny', label: 'Whisper Turbo Tiny (requires download)' },
  { id: 'Xenova/whisper-base', label: 'Whisper Turbo Base (requires download)' },
  { id: 'Xenova/whisper-small', label: 'Whisper Turbo Small (requires download)' },
  { id: 'Xenova/whisper-medium', label: 'Whisper Turbo Medium (requires download)' },
]

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
}

const save = () => {
  store.config.stt.silenceDetection = (duration.value != 0)
  store.config.stt.silenceDuration = parseInt(duration.value)
  store.saveSettings()
}

const onChangeModel = () => {
  previoousModel = `${store.config.stt.model}`
  store.config.stt.model = model.value
  const engine = getSTTEngine(store.config)
  if (engine.requiresDownload()) {
    Swal.fire({
      target: document.querySelector('.settings .voice'),
      title: 'This engine needs to be configured first! Do you want to open the Settings?',
      confirmButtonText: 'Configure',
      showCancelButton: true,
    }).then((result) => {
      if (result.isConfirmed) {
        initializeEngine(engine)
      } else {
        store.config.stt.model = previoousModel
        model.value = previoousModel
      }
    })
  } else {
    initializeEngine(engine)
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
      store.config.stt.model = previoousModel
      model.value = previoousModel
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
