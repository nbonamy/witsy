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
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { CustomEngineConfig } from '../types/config'
import { Ref, ref, computed, nextTick } from 'vue'
import { store } from '../services/store'
import Dialog from '../composables/dialog'
import EngineLogo from '../components/EngineLogo.vue'
import CreateEngine from '../screens/CreateEngine.vue'
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
import SettingsCustomLLM from './SettingsCustomLLM.vue'
import LlmFactory from '../llms/llm'

type Engine = {
  id: string,
  label: string
}

const llmFactory = new LlmFactory(store.config)

const createEngine = ref(null)
const currentEngine:Ref<string> = ref(llmFactory.getChatEngines({ favorites: false })[0])
const engineSettings = ref(null)

const isCustom = computed(() => llmFactory.isCustomEngine(currentEngine.value))

const engines = computed(() => {
  return llmFactory.getChatEngines({ favorites: false }).map(id => {
    if (llmFactory.isCustomEngine(id)) {
      return {
        id: id,
        label: (store.config.engines[id] as CustomEngineConfig).label
      }
    } else {
      return {
        id: id,
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
        }[id]
      }
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
  return SettingsCustomLLM
})

const selectEngine = (engine: Engine) => {
  currentEngine.value = engine.id
  nextTick(() => engineSettings.value.load())
}

const showCreateCustom = () => {
  createEngine.value.show()
}

const onCreateCustom = (payload: { label: string, api: string, baseURL: string, apiKey: string}) => {
  const uuid = 'c' + crypto.randomUUID().replace(/-/g, '')
  store.config.engines[uuid] = {
    label: payload.label,
    api: payload.api,
    baseURL: payload.baseURL,
    apiKey: payload.apiKey,
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
      selectEngine({ id: llmFactory.getChatEngines()[0] } as Engine)
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