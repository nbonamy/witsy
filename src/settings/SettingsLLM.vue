<template>
  <div class="content">
    <div class="list-panel">
      <div class="master">
        <div class="list">
          <div class="item" v-for="engine in engines" :key="engine.id" :class="{ selected: currentEngine == engine.id }" @click="selectEngine(engine)">
            <EngineLogo :engine="engine.id" :grayscale="true" />
            {{ engine.label }}
          </div>
        </div>
        <div class="actions">
          <button class="button create" @click.prevent="showCreateCustom"><BIconPlusLg /> <span v-if="!isCustom">{{ t('settings.engines.custom.create') }}</span></button>
          <button class="button delete" @click.prevent="onDeleteCustom" v-if="isCustom"><BIconTrash /> {{ t('settings.engines.custom.delete') }}</button>
        </div>
      </div>
      <component :is="currentView" class="panel" ref="engineSettings" :engine="currentEngine" />
    </div>
    <CreateEngine ref="createEngine" @create="onCreateCustom" />
  </div>
</template>

<script setup lang="ts">

import { CustomEngineConfig } from '../types/config'
import { Ref, ref, computed, nextTick } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import EngineLogo from '../components/EngineLogo.vue'
import CreateEngine from '../screens/CreateEngine.vue'
import SettingsAnthropic from './SettingsAnthropic.vue'
import SettingsAzure from './SettingsAzure.vue'
import SettingsCerebras from './SettingsCerebras.vue'
import SettingsDeepSeek from './SettingsDeepSeek.vue'
import SettingsGoogle from './SettingsGoogle.vue'
import SettingsGroq from './SettingsGroq.vue'
import SettingsMistralAI from './SettingsMistralAI.vue'
import SettingsOllama from './SettingsOllama.vue'
import SettingsOpenAI from './SettingsOpenAI.vue'
import SettingsOpenRouter from './SettingsOpenRouter.vue'
import SettingsXAI from './SettingsXAI.vue'
import SettingsCustomLLM from './SettingsCustomLLM.vue'
import LlmFactory, { ILlmManager } from '../llms/llm'

type Engine = {
  id: string,
  label: string
}

const llmManager: ILlmManager = LlmFactory.manager(store.config)

const createEngine = ref(null)
const currentEngine:Ref<string> = ref(llmManager.getChatEngines({ favorites: false })[0])
const engineSettings = ref(null)

const isCustom = computed(() => llmManager.isCustomEngine(currentEngine.value))

const engines = computed(() => {
  const engines = llmManager.getChatEngines({ favorites: false }).map(id => {
    if (llmManager.isCustomEngine(id)) {
      return {
        id: id,
        label: (store.config.engines[id] as CustomEngineConfig).label
      }
    } else {
      return {
        id: id,
        label: {
          anthropic: 'Anthropic',
          azure: 'Azure',
          cerebras: 'Cerebras',
          deepseek: 'DeepSeek',
          google: 'Google',
          groq: 'Groq',
          mistralai: 'Mistral AI',
          ollama: 'Ollama',
          openai: 'OpenAI',
          openrouter: 'OpenRouter',
          xai: 'xAI',
        }[id]
      }
    }
  })

  // add azure after mistralai
  const idx = engines.findIndex(e => e.id == 'mistralai')
  engines.splice(idx + 1, 0, {
    id: 'azure',
    label: 'Azure'
  })

  // done
  return engines
})

const currentView = computed(() => {
  if (currentEngine.value == 'anthropic') return SettingsAnthropic
  if (currentEngine.value == 'azure') return SettingsAzure
  if (currentEngine.value == 'cerebras') return SettingsCerebras
  if (currentEngine.value == 'deepseek') return SettingsDeepSeek
  if (currentEngine.value == 'google') return SettingsGoogle
  if (currentEngine.value == 'groq') return SettingsGroq
  if (currentEngine.value == 'mistralai') return SettingsMistralAI
  if (currentEngine.value == 'ollama') return SettingsOllama
  if (currentEngine.value == 'openai') return SettingsOpenAI
  if (currentEngine.value == 'openrouter') return SettingsOpenRouter
  if (currentEngine.value == 'xai') return SettingsXAI
  return SettingsCustomLLM
})

const selectEngine = (engine: Engine) => {
  currentEngine.value = engine.id
  nextTick(() => engineSettings.value.load())
}

const showCreateCustom = () => {
  createEngine.value.show()
}

const onCreateCustom = (payload: { label: string, api: string, baseURL: string, apiKey: string, deployment: string, apiVersion: string}) => {
  const uuid = 'c' + crypto.randomUUID().replace(/-/g, '')
  store.config.engines[uuid] = {
    label: payload.label,
    api: payload.api,
    baseURL: payload.baseURL,
    apiKey: payload.apiKey,
    deployment: payload.deployment,
    apiVersion: payload.apiVersion,
    models: { chat: [], image: [] },
    model: { chat: '', image: '' }
  }
  store.saveSettings()
  selectEngine({ id: uuid } as Engine)
  nextTick(() => engineSettings.value.loadModels())
}

const onDeleteCustom = () => {
  Dialog.show({
    target: document.querySelector('.settings .plugins'),
    title: t('settings.engines.custom.confirmDelete'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      delete store.config.engines[currentEngine.value]
      selectEngine({ id: llmManager.getChatEngines()[0] } as Engine)
      store.saveSettings()
    }
  })
}

const load = (payload: { engine: string }) => {
  if (payload?.engine) {
    selectEngine({ id: payload.engine } as Engine)
  } else {
    engineSettings.value.load()
  }
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

.list {
  max-height: 208px;
}

.actions {
  display: flex;
  flex-direction: row;
  justify-content: start;
  align-self: stretch;
  border-top: 1px solid var(--actions-bar-border-color);
  padding-left: 6px;

  button {
    border: 0px;
    border-radius: 0px;
    background-color: transparent;
    margin: 0px;
    font-size: 10pt;
    padding: 2px;

    &:active {
      background: var(--actions-bar-button-active-bg-color);
    }

    svg {
      position: relative;
      top: 2px;
    }
  }
}

</style>