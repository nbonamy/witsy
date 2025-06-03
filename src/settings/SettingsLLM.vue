<template>
  <form class="tab-content vertical large">
    <header>
      <div class="title">{{ t('settings.tabs.llm') }}</div>
    </header>
    <main>
      <div class="group prompt">
        <label>{{ t('settings.general.promptLLMModel') }}</label>
        <EngineSelect class="engine" v-model="engine" @change="onChangeEngine" :default-text="t('settings.general.lastOneUsed')" />
        <ModelSelectPlus class="model" v-model="model" @change="onChangeModel" :engine="engine" :default-text="!models.length ? t('settings.general.lastOneUsed') : ''" />
      </div>
      <div class="group localeLLM">
        <label>{{ t('settings.general.localeLLM') }}</label>
        <div class="subgroup">
          <LangSelect v-model="localeLLM" @change="onChangeLocaleLLM" />
          <div class="checkbox">
            <input type="checkbox" v-model="forceLocale" :disabled="!isLocalized" @change="save" />
            <div class="label">{{ t('settings.general.forceLocale') }}</div>
          </div>
        </div>
      </div>
      <div class="group length">
        <label>{{ t('settings.advanced.conversationLength') }}</label>
        <input type="number" min="1" v-model="conversationLength" @change="save">
      </div>
    </main>
  </form>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { store } from '../services/store'
import { hasLocalization, t } from '../services/i18n'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelectPlus from '../components/ModelSelectPlus.vue'
import LangSelect from '../components/LangSelect.vue'

const isMas = ref(false)
const engine = ref(null)
const model = ref(null)
const localeLLM = ref(null)
const isLocalized = ref(false)
const forceLocale = ref(false)
const conversationLength = ref(null)

const models = computed(() => {
  if (!engine.value || engine.value == '') return []
  if (!store.config.engines[engine.value]) {
    engine.value = ''
    model.value = ''
    save()
    return []
  }
  return store.config.engines[engine.value].models.chat
})

const load = () => {
  isMas.value = window.api.isMasBuild
  engine.value = store.config.prompt.engine || ''
  model.value = store.config.prompt.model || ''
  localeLLM.value = store.config.llm.locale
  forceLocale.value = store.config.llm.forceLocale
  conversationLength.value = store.config.llm.conversationLength || 5
  onChangeLocaleLLM()
}

const save = () => {
  store.config.prompt.engine = engine.value
  store.config.prompt.model = model.value
  store.config.llm.locale = localeLLM.value
  store.config.llm.forceLocale = forceLocale.value
  store.config.llm.conversationLength = conversationLength.value
  store.saveSettings()
}

const onChangeEngine = () => {
  if (engine.value == '') model.value = ''
  else model.value = store.config.engines[engine.value].models.chat?.[0]?.id
  save()
}

const onChangeModel = () => {
  save()
}

const onChangeLocaleLLM = () => {
  save()
  isLocalized.value = hasLocalization(window.api.config.getI18nMessages(), window.api.config.localeLLM())
  if (!isLocalized.value) {
    forceLocale.value = true
    save()
  }
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/themes/base.css';
@import '../../css/themes/openai.css';
@import '../../css/themes/conversation.css';
</style>

<style scoped>

.localeLLM div.checkbox {
  display: flex;
  align-items: start;
  margin-top: 8px;
  gap: 6px;
}

.localeLLM div.checkbox input[type="checkbox"] {
  flex-basis: 25px;
  margin-left: 0px;
}

.localeLLM div.checkbox div.label {
  margin-top: 2px;
}

</style>