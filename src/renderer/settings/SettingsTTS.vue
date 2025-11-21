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
    <div class="form-field" v-if="engine === 'minimax'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="minimaxAPIKey" @blur="save" />
    </div>
    <div class="form-field" v-if="engine !== 'custom'">
      <label>{{ t('settings.voice.model') }}</label>
      <select v-model="model" @change="onChangeModel">
        <option v-for="model in models" :key="model.id" :value="model.id">
          {{ model.label }}
        </option>
      </select>
    </div>
    <template v-else>
      <div class="form-field">
        <label>{{ t('settings.engines.custom.apiBaseURL') }}</label>
        <input name="baseURL" v-model="baseURL" :placeholder="defaults.engines.openai.baseURL" @change="save"/>
      </div>
      <div class="form-field">
        <label>{{ t('settings.voice.model') }}</label>
        <input name="model" v-model="model" @change="onChangeModel"/>
      </div>
    </template>
    <div class="form-field">
      <label>{{ t('settings.voice.tts.voice') }}</label>
      <div class="control-group">
        <select v-if="engine !== 'custom'" v-model="voice" @change="save">
          <option v-for="voice in voices" :key="voice.id" :value="voice.id">
            {{ voice.label }}
          </option>
        </select>
        <input v-else name="voice" v-model="voice" @change="save"/>
        <RefreshButton @refresh="onRefreshVoices" v-if="canRefreshVoices" />
        <button class="control" @click.prevent="onPlay">
          <PlayIcon v-if="audioState.state === 'idle'"/>
          <SquareIcon v-else />
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

import { PlayIcon, SquareIcon } from 'lucide-vue-next'
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import InputObfuscated from '../components/InputObfuscated.vue'
import RefreshButton from '../components/RefreshButton.vue'
import useAudioPlayer, { AudioStatus } from '../audio/audio_player'
import { t } from '@services/i18n'
import { store } from '@services/store'
import { getTTSModels, getTTSEngines } from '../voice/tts'
import TTSElevenLabs from '../voice/tts-elevenlabs'
import TTSFalAi from '../voice/tts-falai'
import TTSGroq from '../voice/tts-groq'
import TTSOpenAI from '../voice/tts-openai'
import TTSMiniMax from '../voice/tts-minimax'
import defaults from '@root/defaults/settings.json'
import Dialog from '@renderer/utils/dialog'

const engine = ref('openai')
const voice = ref(null)
const model = ref(null)
const openaiAPIKey = ref(null)
const groqAPIKey = ref(null)
const falaiAPIKey = ref(null)
const elevenlabsAPIKey = ref(null)
const minimaxAPIKey = ref(null)
const baseURL = ref('')
const audio= ref<HTMLAudioElement|null>(null)
  const audioState= ref<{state: string, messageId: string|null}>({
  state: 'idle',
  messageId: null,
})

const audioPlayer = useAudioPlayer(store.config)

const engines = getTTSEngines()

const models = computed(() => {
  return getTTSModels(engine.value) || []
})

const canRefreshVoices = computed(() => {
  return engine.value === 'elevenlabs' || engine.value === 'minimax'
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
  } else if (engine.value === 'minimax') {
    if (store.config.engines.minimax?.voices?.length) {
      return store.config.engines.minimax.voices
    } else {
      return TTSMiniMax.voices(model.value)
    }
  } else if (engine.value === 'custom') {
    return TTSOpenAI.voices(model.value)
  // } else if (engine.value === 'replicate') {
  //   return TTSReplicate.models(model.value)
  // } else if (engine.value === 'kokoro') {
  //   return TTSKokoro.voices(model.value)
  }
  return []

})

onMounted(() => {
  audioPlayer.addListener(onAudioPlayerStatus)
})

onBeforeUnmount(() => {
  audioPlayer.removeListener(onAudioPlayerStatus)
})

const onChangeEngine = () => {
  model.value = models.value.length ? models.value[0].id : ''
  onChangeModel()
}

const onChangeModel = () => {
  voice.value = voices.value.length ? voices.value[0].id : ''
  save()
}

const onAudioPlayerStatus = (status: AudioStatus) => {
  audioState.value = { state: status.state, messageId: status.uuid }
  if (status.state === 'paused') {
    audioPlayer.stop()
  }
}

const onPlay = async () => {
  if (audioState.value.state !== 'idle') {
    audioPlayer.stop()
  } else {
    const success = await audioPlayer.play(audio.value!, 'sample', t('settings.voice.tts.sampleText'))
    if (!success) {
      Dialog.alert(t('settings.voice.tts.playbackError'))
    }
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
  } else if (engine.value === 'minimax') {
    const engine = new TTSMiniMax(store.config)
    const voices = await engine.getVoices(model.value)
    if (voices?.length) {
      if (!store.config.engines.minimax) {
        store.config.engines.minimax = { models: {}, model: {} } as any
      }
      store.config.engines.minimax.voices = voices
      store.saveSettings()
      return true
    }
  }
  return false
}

const load = () => {
  engine.value = store.config.tts?.engine || 'openai'
  model.value = store.config.tts?.model || ''
  voice.value = store.config.tts?.voice || ''
  openaiAPIKey.value = store.config.engines.openai?.apiKey || ''
  groqAPIKey.value = store.config.engines.groq?.apiKey || ''
  falaiAPIKey.value = store.config.engines.falai?.apiKey || ''
  elevenlabsAPIKey.value = store.config.engines.elevenlabs?.apiKey || ''
  minimaxAPIKey.value = store.config.engines.minimax?.apiKey || ''
  baseURL.value = store.config.tts.customOpenAI?.baseURL || ''
}

const save = () => {
  store.config.tts.engine = engine.value
  store.config.tts.model = model.value
  store.config.tts.voice = voice.value
  store.config.engines.openai.apiKey = openaiAPIKey.value
  store.config.engines.groq.apiKey = groqAPIKey.value
  store.config.engines.falai.apiKey = falaiAPIKey.value
  store.config.engines.elevenlabs.apiKey = elevenlabsAPIKey.value
  if (!store.config.engines.minimax) {
    store.config.engines.minimax = { models: {}, model: {} } as any
  }
  store.config.engines.minimax.apiKey = minimaxAPIKey.value
  store.config.tts.customOpenAI.baseURL = baseURL.value
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