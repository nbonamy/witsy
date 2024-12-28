
<template>
  <div class="content">
    <div class="list-panel">
      <div class="list">
        <div class="item" v-for="engine in engines" :key="engine.id" :class="{ selected: currentEngine == engine.id }" @click="selectEngine(engine)">
          <EngineLogo :engine="engine.id" :grayscale="true" />
          {{ engine.label }}
        </div>
      </div>
      <component :is="currentView" class="panel" ref="engineSettings" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, computed, nextTick } from 'vue'
import { availableEngines } from '../llms/llm'
import EngineLogo from '../components/EngineLogo.vue'
import SettingsOpenAI from './SettingsOpenAI.vue'
import SettingsOllama from './SettingsOllama.vue'
import SettingsMistralAI from './SettingsMistralAI.vue'
import SettingsAnthropic from './SettingsAnthropic.vue'
import SettingsGoogle from './SettingsGoogle.vue'
import SettingsGroq from './SettingsGroq.vue'
import SettingsCerberas from './SettingsCerebras.vue'
import SettingsXAI from './SettingsXAI.vue'
import SettingsDeepSeek from './SettingsDeepSeek.vue'
import SettingsOpenRouter from './SettingsOpenRouter.vue'

const currentEngine = ref(availableEngines[0])
const engineSettings = ref(null)

type Engine = { id: string, label: string }

const engines = computed(() => {
  return availableEngines.map(engine => {
    return {
      id: engine,
      label: {
        openai: 'OpenAI',
        ollama: 'Ollama',
        anthropic: 'Anthropic',
        mistralai: 'Mistral AI',
        google: 'Google',
        xai: 'xAI',
        openrouter: 'OpenRouter',
        deepseek: 'DeepSeek',
        groq: 'Groq',
        cerebras: 'Cerebras',
      }[engine],
    }
  })
})

const currentView = computed(() => {
  if (currentEngine.value == 'openai') return SettingsOpenAI
  if (currentEngine.value == 'ollama') return SettingsOllama
  if (currentEngine.value == 'anthropic') return SettingsAnthropic
  if (currentEngine.value == 'mistralai') return SettingsMistralAI
  if (currentEngine.value == 'google') return SettingsGoogle
  if (currentEngine.value == 'xai') return SettingsXAI
  if (currentEngine.value == 'deepseek') return SettingsDeepSeek
  if (currentEngine.value == 'openrouter') return SettingsOpenRouter
  if (currentEngine.value == 'groq') return SettingsGroq
  if (currentEngine.value == 'cerebras') return SettingsCerberas
})

const selectEngine = (engine: Engine) => {
  currentEngine.value = engine.id
  nextTick(() => engineSettings.value.load())
}

const load = (payload: { engine: string }) => {
  if (payload?.engine) {
    currentEngine.value = payload.engine
  }
  engineSettings.value.load()
}

const save = () => {
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>
