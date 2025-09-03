<template>
  <div class="form form-vertical form-large">
    <div class="form-field">
      <label>{{ t('settings.voice.engine') }}</label>
      <select v-model="engine" @change="onChangeEngine">
        <option v-for="engine in engines" :key="engine.id" :value="engine.id">
          {{ engine.label }}
        </option>
      </select>
    </div>
    <div class="form-field" v-if="engine == 'openai'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="openaiAPIKey" @blur="save" />
    </div>
    <div class="form-field" v-if="engine == 'groq'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="groqAPIKey" @blur="save" />
    </div>
    <div class="form-field" v-if="engine == 'elevenlabs'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="elevenlabsAPIKey" @blur="save" />
    </div>
    <div class="form-field" v-if="engine === 'falai'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="falaiAPIKey" @blur="save" />
    </div>
    <div class="form-field">
      <label>{{ t('settings.voice.model') }}</label>
      <select v-model="model" @change="onChangeModel">
        <option v-for="model in models" :key="model.id" :value="model.id">
          {{ model.label }}
        </option>
      </select>
    </div>
    <div class="form-field">
      <label>{{ t('settings.voice.tts.voice') }}</label>
      <div class="control-group">
        <select v-model="voice" @change="save">
          <option v-for="voice in voices" :key="voice.id" :value="voice.id">
            {{ voice.label }}
          </option>
        </select>
        <RefreshButton :onRefresh="onRefreshVoices" />
        <button class="control" @click.prevent="onPlay">
          <BIconPlayFill v-if="audioState.state === 'idle'"/>
          <BIconStopFill v-else />
        </button>
      </div>
      <audio ref="audio" />
    </div>
    <!-- <div class="form-field" v-if="engine === 'kokoro'">
      <label></label>
      <span>{{ t('settings.voice.tts.kokoroReminder') }} <a href="https://kokorotts.com" target="_blank">Kokoro TTS</a>. {{ t('settings.voice.tts.serviceDisclaimer') }}</span>
    </div> -->
    <div class="form-field" v-if="engine === 'groq'">
      <label></label>
      <span v-html="t('settings.voice.tts.groqAcceptTermsReminder')"></span>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, onMounted, onUnmounted, computed } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import useAudioPlayer, { AudioStatus } from '../composables/audio_player'
import InputObfuscated from '../components/InputObfuscated.vue'
import RefreshButton from '../components/RefreshButton.vue'
import { getTTSModels } from '../voice/tts'
import TTSOpenAI from '../voice/tts-openai'
import TTSGroq from '../voice/tts-groq'
import TTSElevenLabs from '../voice/tts-elevenlabs'
import TTSFalAi from '../voice/tts-falai'

const engine = ref('openai')
const voice = ref(null)
const model = ref(null)
const openaiAPIKey = ref(null)
const groqAPIKey = ref(null)
const falaiAPIKey = ref(null)
const elevenlabsAPIKey = ref(null)
const audio= ref<HTMLAudioElement|null>(null)
  const audioState= ref<{state: string, messageId: string|null}>({
  state: 'idle',
  messageId: null,
})

const audioPlayer = useAudioPlayer(store.config)

const engines = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'groq', label: 'Groq' },
  { id: 'elevenlabs', label: 'Eleven Labs' },
  // { id: 'replicate', label: 'Replicate' },
  { id: 'falai', label: 'fal.ai' },
  // { id: 'kokoro', label: 'Kokoro' },
]

const models = computed(() => {
  return getTTSModels(engine.value)
})

const canRefreshVoices = computed(() => {
  return engine.value === 'elevenlabs'
})

const voices = computed(() => {

  // get models
  if (engine.value === 'openai') {
    return TTSOpenAI.voices(model.value)
  } else if (engine.value === 'groq') {
    return TTSGroq.voices(model.value)
  } else if (engine.value === 'elevenlabs') {
    if (store.config.engines.elevenlabs?.voices?.length) {
      return store.config.engines.elevenlabs.voices
    } else {
      return TTSElevenLabs.voices(model.value)
    }
  } else if (engine.value === 'falai') {
    return TTSFalAi.voices(model.value)
  // } else if (engine.value === 'replicate') {
  //   return TTSReplicate.models(model.value)
  // } else if (engine.value === 'kokoro') {
  //   return TTSKokoro.voices(model.value)
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
  onChangeModel()
}

const onChangeModel = () => {
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
    audioPlayer.play(audio.value!, 'sample', t('settings.voice.tts.sampleText'))
  }
}

const onRefreshVoices = async (): Promise<boolean> => {
  if (engine.value === 'elevenlabs') {
    const engine = new TTSElevenLabs(store.config)
    const voices = await engine.getVoices(model.value)
    if (voices?.length) {
      store.config.engines.elevenlabs.voices = voices
      store.saveSettings()
      return true
    }
  }
  return false
}

const load = () => {
  engine.value = store.config.tts?.engine || 'openai'
  model.value = store.config.tts?.model || 'tts-1'
  voice.value = store.config.tts?.voice || 'alloy'
  openaiAPIKey.value = store.config.engines.openai?.apiKey || ''  
  groqAPIKey.value = store.config.engines.groq?.apiKey || ''
  falaiAPIKey.value = store.config.engines.falai?.apiKey || ''
  elevenlabsAPIKey.value = store.config.engines.elevenlabs?.apiKey || ''
}

const save = () => {
  store.config.tts.engine = engine.value
  store.config.tts.model = model.value
  store.config.tts.voice = voice.value
  store.config.engines.openai.apiKey = openaiAPIKey.value
  store.config.engines.groq.apiKey = groqAPIKey.value
  store.config.engines.falai.apiKey = falaiAPIKey.value
  store.config.engines.elevenlabs.apiKey = elevenlabsAPIKey.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
.control {
  svg {
    position: relative;
    top: 1px;
  }
}
</style>