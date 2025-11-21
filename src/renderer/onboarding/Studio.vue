
<template>

  <section>

    <header>
      <h1>{{ t('onboarding.studio.title') }}</h1>
      <h3>{{ t('onboarding.studio.subtitle') }}</h3>
    </header>

    <div class="form form-large">
      <div class="engines-grid">
        <div class="engine form-field" v-for="engine in engines" :key="engine">
          <div class="brand">
            <EngineLogo :engine="engine" :grayscale="appearanceTheme.isDark" />
            <span>{{ engineNames[engine] || engine }}</span>
          </div>
          <div class="config">
            <InputObfuscated v-model="store.config.engines[engine].apiKey" @keydown="onKeyDown" @change="loadModels(engine)"/>
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

import { computed, ref } from 'vue'
import EngineLogo from '../components/EngineLogo.vue'
import InputObfuscated from '../components/InputObfuscated.vue'
import Spinner from '../components/Spinner.vue'
import { t } from '@services/i18n'
import ImageCreator from '@services/image'
import { engineNames } from '@services/llms/consts'
import LlmManager from '@services/llms/manager'
import ModelLoaderFactory from '@services/model_loader'
import { store } from '@services/store'
import VideoCreator from '@services/video'
import { preventTabOnLastEngineGridInput } from './index'

import useAppearanceTheme from '@composables/appearance_theme'
const appearanceTheme = useAppearanceTheme()

const status = ref<Record<string, string>>({})
const success = ref<Record<string, string>>({})
const errors = ref<Record<string, string>>({})
const loading = ref<Record<string, boolean>>({})

const llmManager = new LlmManager(store.config)
let timeouts: Record<string, NodeJS.Timeout> = {}

const engines = computed(() => {
  const imageEngines = ImageCreator.getEngines(false).map(e => e.id)
  const videoEngines = VideoCreator.getEngines(false).map(e => e.id)
  return [...new Set([...imageEngines, ...videoEngines])].filter(engine => {
    if (engine === 'sdwebui') return false
    return true
  }).sort()
})

const onVisible = () => {
  engines.value.forEach(engine => {
    const totalModels = getTotalModelsCount(engine)
    if (store.config.engines[engine].apiKey && totalModels > 0) {
      status.value[engine] = t('onboarding.studio.already', {
        engine: engineNames[engine] || engine,
      }) + '<br/>' + t('onboarding.studio.count', {
        count: totalModels,
      })
    }
  })
}

const getTotalModelsCount = (engine: string) => {
  const models = store.config.engines[engine]?.models
  if (!models) return 0
  
  const imageCount = models.image?.length || 0
  const imageEditCount = models.imageEdit?.length || 0
  const videoCount = models.video?.length || 0
  const videoEditCount = models.videoEdit?.length || 0
  
  return imageCount + imageEditCount + videoCount + videoEditCount
}

const loadModels = (engine: string) => {

  clearTimeout(timeouts[engine])

  if (!store.config.engines[engine].apiKey) {
    success.value[engine] = ''
    errors.value[engine] = ''
    return
  }

  store.saveSettings()

  timeouts[engine] = setTimeout(async () => {

    status.value[engine] = ''
    success.value[engine] = ''
    errors.value[engine] = ''
    loading.value[engine] = true

    try {
      let loadResult = false
      
      // Use explicit instantiation for engines that need it
      if (['replicate', 'falai', 'huggingface', 'sdwebui'].includes(engine)) {
        const modelLoader = ModelLoaderFactory.create(store.config, engine)
        loadResult = await modelLoader.loadModels()
      } else {
        // Use LlmManager for other engines
        loadResult = await llmManager.loadModels(engine)
      }

      loading.value[engine] = false

      const totalModels = getTotalModelsCount(engine)
      if (loadResult && totalModels > 0) {
        status.value[engine] = ''
        success.value[engine] = t('onboarding.studio.success', {
          engine: engineNames[engine] || engine,
        }) + '<br/>' + t('onboarding.chat.count', {
          count: totalModels,
        })
        errors.value[engine] = ''
      } else {
        status.value[engine] = ''
        success.value[engine] = ''
        errors.value[engine] = t('onboarding.studio.error')
      }
    } catch (error) {
      loading.value[engine] = false
      status.value[engine] = ''
      success.value[engine] = ''
      errors.value[engine] = t('onboarding.studio.error')
    }
  
  }, 500)
}

const onKeyDown = (event: KeyboardEvent) => {
  preventTabOnLastEngineGridInput(event)
}

defineExpose({
  onVisible,
})

</script>

<style scoped>
@import '@css/onboarding.css';
</style>
