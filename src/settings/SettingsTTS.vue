
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
      <select v-model="model" @change="save">
        <option v-for="model in models" :key="model.id" :value="model.id">
          {{ model.label }}
        </option>
      </select>
    </div>
    <div class="group">
      <label>Voice</label>
      <select v-model="voice" @change="save">
        <option v-for="voice in voices" :key="voice.id" :value="voice.id">
          {{ voice.label }}
        </option>
      </select>
    </div>
    <div class="group" v-if="engine === 'openai'">
      <label></label>
      <span>Make sure you enter your OpenAI API key in the Models pane.</span>
    </div>
    <div class="group" v-if="engine === 'kokoro'">
      <label></label>
      <span>Provided <a href="https://kokorotts.com" target="_blank">Kokoro TTS</a>. The service may stop working at any point in time.</span>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { store } from '../services/store'
import TTSOpenAI from '../voice/tts-openai'
import TTSReplicate from '../voice/tts-replicate'
import TTSKokoro from '../voice/tts-kokoro'

const engine = ref('openai')
const voice = ref(null)
const model = ref(null)

const engines = [
  { id: 'openai', label: 'OpenAI' },
  // { id: 'replicate', label: 'Replicate' },
  { id: 'kokoro', label: 'Kokoro' },
]

const models = computed(() => {

  // get models
  if (engine.value === 'openai') {
    return TTSOpenAI.models
  // } else if (engine.value === 'replicate') {
  //   return TTSReplicate.models
  } else if (engine.value === 'kokoro') {
    return TTSKokoro.models
  }

})

const voices = computed(() => {

  // get models
  if (engine.value === 'openai') {
    return TTSOpenAI.voices
  // } else if (engine.value === 'replicate') {
  //   return TTSReplicate.models
  } else if (engine.value === 'kokoro') {
    return TTSKokoro.voices
  }

})

const onChangeEngine = () => {
  model.value = models.value[0].id
  voice.value = voices.value[0].id
  save()
}

const load = () => {
  engine.value = store.config.tts?.engine || 'openai'
  model.value = store.config.tts?.model || 'tts-1'
  voice.value = store.config.tts?.voice || 'alloy'
}

const save = () => {
  store.config.tts.engine = engine.value
  store.config.tts.model = model.value
  store.config.tts.voice = voice.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>
