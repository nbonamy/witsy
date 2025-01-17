
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
    <div class="group" v-if="engine == 'elevenlabs'">
      <label>API key</label>
      <InputObfuscated v-model="elevenlabsAPIKey" @blur="save" />
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
      <button @click.prevent="onPlay">
        <BIconPlayFill v-if="audioState.state === 'idle'"/>
        <BIconStopFill v-else />
      </button>
      <audio ref="audio" />
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

import { Ref, ref, onMounted, onUnmounted, computed } from 'vue'
import { store } from '../services/store'
import useAudioPlayer, { AudioStatus } from '../composables/audio_player'
import InputObfuscated from '../components/InputObfuscated.vue'
import TTSOpenAI from '../voice/tts-openai'
import TTSKokoro from '../voice/tts-kokoro'
import TTSElevenLabs from '../voice/tts-elevenlabs'

const engine = ref('openai')
const voice = ref(null)
const model = ref(null)
const elevenlabsAPIKey = ref(null)
const audio: Ref<HTMLAudioElement|null> = ref(null)
  const audioState: Ref<{state: string, messageId: string|null}> = ref({
  state: 'idle',
  messageId: null,
})

const audioPlayer = useAudioPlayer(store.config)

const engines = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'elevenlabs', label: 'Eleven Labs' },
  // { id: 'replicate', label: 'Replicate' },
  { id: 'kokoro', label: 'Kokoro' },
]

const models = computed(() => {

  // get models
  if (engine.value === 'openai') {
    return TTSOpenAI.models
  } else if (engine.value === 'elevenlabs') {
    return TTSElevenLabs.models
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
  } else if (engine.value === 'elevenlabs') {
    return TTSElevenLabs.voices
  // } else if (engine.value === 'replicate') {
  //   return TTSReplicate.models
  } else if (engine.value === 'kokoro') {
    return TTSKokoro.voices
  }

})

onMounted(() => {
  audioPlayer.addListener(onAudioPlayerStatus)
})

onUnmounted(() => {
  audioPlayer.removeListener(onAudioPlayerStatus)
})

const onChangeEngine = () => {
  model.value = models.value[0].id
  voice.value = voices.value[0].id
  save()
}

const onAudioPlayerStatus = (status: AudioStatus) => {
  audioState.value = { state: status.state, messageId: status.uuid }
  if (status.state === 'paused') {
    audioPlayer.stop()
  }
}

const onPlay = () => {
  if (audioState.value.state !== 'idle') {
    audioPlayer.stop()
  } else {
    audioPlayer.play(audio.value!, 'sample', 'Welcome to Witsy, the ultimate AI desktop assistant.')
  }
}

const load = () => {
  engine.value = store.config.tts?.engine || 'openai'
  model.value = store.config.tts?.model || 'tts-1'
  voice.value = store.config.tts?.voice || 'alloy'
  elevenlabsAPIKey.value = store.config.engines.elevenlabs?.apiKey || ''
}

const save = () => {
  store.config.tts.engine = engine.value
  store.config.tts.model = model.value
  store.config.tts.voice = voice.value
  store.config.engines.elevenlabs.apiKey = elevenlabsAPIKey.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>
