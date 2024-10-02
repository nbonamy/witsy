
<template>
  <div>
    <div class="group">
      <label>OpenAI Model</label>
      <select v-model="model" @change="save">
        <option v-for="model in models" :key="model.id" :value="model.id">
          {{ model.label }}
        </option>
      </select>
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
      <span>Make sure you enter your OpenAI API key in the Models pane.</span>
    </div>
  </div>
</template>

<script setup>

import { ref } from 'vue'
import { store } from '../services/store'

const model = ref('whisper-1')
const duration = ref(null)

const models = [
  { id: 'whisper-1', label: 'Whisper V2' },
]

const load = () => {
  const detection = store.config.stt.silenceDetection
  duration.value = detection ? store.config.stt.silenceDuration || 2000 : 0
}

const save = () => {
  store.config.stt.silenceDetection = (duration.value != 0)
  store.config.stt.silenceDuration = parseInt(duration.value)
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>
