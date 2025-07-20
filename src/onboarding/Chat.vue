
<template>

  <section>

    <header>
      <h1>{{ t('onboarding.chat.title') }}</h1>
      <h3>{{ t('onboarding.chat.subtitle') }}</h3>
    </header>

    <div class="form form-large">
      <div class="engines-grid">
        <div class="engine form-field" v-for="engine in engines" :key="engine">
          <div class="brand">
            <EngineLogo :engine="engine" :grayscale="appearanceTheme.isDark" />
            <span>{{ engineNames[engine] }}</span>
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
import { engineNames } from '../llms/base'
import LlmManager from '../llms/manager'
import Spinner from '../components/Spinner.vue'
import EngineLogo from '../components/EngineLogo.vue'
import InputObfuscated from '../components/InputObfuscated.vue'

import useAppearanceTheme from '../composables/appearance_theme'
const appearanceTheme = useAppearanceTheme()

const status = ref<Record<string, string>>({})
const success = ref<Record<string, string>>({})
const errors = ref<Record<string, string>>({})
const loading = ref<Record<string, boolean>>({})

const llmManager = new LlmManager(store.config)
let timeouts: Record<string, NodeJS.Timeout> = {}

const engines = computed(() => llmManager.getStandardEngines().filter(e => {
  return e !== 'ollama' && e !== 'lmstudio'
}))

onMounted(() => {
  engines.value.forEach(engine => {
    if (store.config.engines[engine].apiKey && store.config.engines[engine].models.chat.length) {
      status.value[engine] = t('onboarding.chat.already', {
        engine: engineNames[engine] || engine,
      }) + '<br/>' + t('onboarding.chat.count', {
        count: store.config.engines[engine].models.chat.length,
      })
    }
  })
})

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
    await llmManager.loadModels(engine)
    loading.value[engine] = false

    if (store.config.engines[engine].models.chat.length) {
      status.value[engine] = ''
      success.value[engine] = t('onboarding.chat.success', {
        engine: engineNames[engine] || engine,
      }) + '<br/>' + t('onboarding.chat.count', {
        count: store.config.engines[engine].models.chat.length,
      })
      errors.value[engine] = ''
    } else {
      status.value[engine] = ''
      success.value[engine] = ''
      errors.value[engine] = t('onboarding.chat.error')
    }
  
  }, 500)
}

</script>

<style scoped>
@import '../../css/onboarding.css';
</style>
