
<template>
  <div class="content">
    <div class="llm">
      <div class="engines">
        <div class="engine" v-for="engine in engines" :key="engine.id" :class="{ selected: currentEngine == engine.id }" @click="selectEngine(engine)">
          <EngineLogo :engine="engine.id" :grayscale="true" />
          {{ engine.label }}
        </div>
      </div>
      <component :is="currentView" class="settings" ref="engineSettings" />
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

<style scoped>

dialog.settings .content {
  width: 100%;
  height: 100%;
  padding: 0px;
}

.llm {
  
  display: flex;
  flex-direction: row;
  align-items: stretch;

  .engines {
    background-color: var(--sidebar-bg-color);
    border-right: 0.5px solid var(--dialog-separator-color);
    width: 140px;
    padding: 10px;

    .engine {

      flex-direction: row;
      align-items: center;
      height: 24px;
      padding: 0px 8px;
      margin: 2px 0px;
      display: flex;
      border-radius: 4px;
      font-size: 10.5pt;

      .logo {
        height: 10pt;
        margin-right: 4px;
      }

      &.selected {
        background-color: var(--highlight-color);
        color: var(--highlighted-color);
        .logo {
          filter: invert(1);
        }
      }
    }
  }

}

.settings {
  flex: 1;
  min-height: 200px;
  padding: 16px 16px 16px 0px !important;
}

</style>