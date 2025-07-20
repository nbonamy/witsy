
<template>

  <section>

    <header>
      <h1>{{ t('onboarding.voice.title') }}</h1>
      <h3>{{ t('onboarding.voice.subtitle') }}</h3>
    </header>

    <div class="form form-large">
      <div class="engines-grid">
        <div class="engine form-field" v-for="engine in engines" :key="engine">
          <div class="brand">
            <EngineLogo :engine="engine" :grayscale="appearanceTheme.isDark" />
            <span>{{ engineNames[engine] || engine }}</span>
          </div>
          <div class="config">
            <InputObfuscated v-model="store.config.engines[engine].apiKey" @change="loadModels(engine)"/>
            <span v-if="status[engine]" class="status" v-html="status[engine]"></span>
            <span v-else-if="success[engine]" class="success" v-html="success[engine]"></span>
            <span v-else-if="errors[engine]" class="error" v-html="errors[engine]"></span>
            <span v-else>
              <template v-if="loading[engine]">
                <Spinner />
              </template>
              <template v-else>&nbsp;</template>
              <br/>
              &nbsp;</span>
          </div>
        </div>
      </div>
    </div>

  </section>

</template>

<script setup lang="ts">

import { computed, onMounted, ref } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { getSTTEngines, getSTTModels } from '../voice/stt'
import { getTTSEngines, getTTSModels } from '../voice/tts'
import { engineNames } from '../llms/base'
import Spinner from '../components/Spinner.vue'
import EngineLogo from '../components/EngineLogo.vue'
import InputObfuscated from '../components/InputObfuscated.vue'

import useAppearanceTheme from '../composables/appearance_theme'
const appearanceTheme = useAppearanceTheme()

const status = ref<Record<string, string>>({})
const success = ref<Record<string, string>>({})
const errors = ref<Record<string, string>>({})
const loading = ref<Record<string, boolean>>({})

let timeouts: Record<string, NodeJS.Timeout> = {}

const engines = computed(() => {
  const sttEngines = getSTTEngines().map(e => e.id)
  const ttsEngines = getTTSEngines().map(e => e.id)
  return [...new Set([...ttsEngines, ...sttEngines])].filter(engine => {
    if (engine === 'whisper' || engine === 'custom') return false
    return true
  }).sort()
})

onMounted(() => {
  engines.value.forEach(engine => {
    const totalModels = getTotalModelsCount(engine)
    if (store.config.engines[engine].apiKey && totalModels > 0) {
      status.value[engine] = t('onboarding.voice.already', {
        engine: engineNames[engine] || engine,
      }) + '<br/>' + t('onboarding.voice.count', {
        count: totalModels,
      })
    }
  })
})

const getTotalModelsCount = (engine: string) => {
  let totalCount = 0
  
  // Get STT models count
  const sttModels = getSTTModels(engine)
  if (sttModels && Array.isArray(sttModels)) {
    totalCount += sttModels.length
  }
  
  // Get TTS models count
  const ttsModels = getTTSModels(engine)
  if (ttsModels && Array.isArray(ttsModels)) {
    totalCount += ttsModels.length
  }
  
  return totalCount
}

const loadModels = (engine: string) => {

  clearTimeout(timeouts[engine])

  if (!store.config.engines[engine].apiKey) {
    success.value[engine] = ''
    errors.value[engine] = ''
    return
  }

  timeouts[engine] = setTimeout(async () => {

    status.value[engine] = ''
    success.value[engine] = ''
    errors.value[engine] = ''
    loading.value[engine] = true

    try {
      // Voice engines don't need explicit model loading like LLM engines
      // They use static model lists, so we just need to check if models are available
      loading.value[engine] = false

      const totalModels = getTotalModelsCount(engine)
      if (totalModels > 0) {
        status.value[engine] = ''
        success.value[engine] = t('onboarding.voice.success', {
          engine: engineNames[engine] || engine,
        }) + '<br/>' + t('onboarding.voice.count', {
          count: totalModels,
        })
        errors.value[engine] = ''
      } else {
        status.value[engine] = ''
        success.value[engine] = ''
        errors.value[engine] = t('onboarding.voice.error')
      }
    } catch (error) {
      loading.value[engine] = false
      status.value[engine] = ''
      success.value[engine] = ''
      errors.value[engine] = t('onboarding.voice.error')
    }
  
  }, 500)
}

</script>

<style scoped>
@import '../../css/onboarding.css';
</style>
