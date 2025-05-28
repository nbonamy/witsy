<template>
  <form class="tab-content vertical large">
    <header>
      <div class="title">{{ t('settings.tabs.general') }}</div>
    </header>
    <main>
      <div class="group prompt">
        <label>{{ t('settings.general.promptLLMModel') }}</label>
        <EngineSelect class="engine" v-model="engine" @change="onChangeEngine" :default-text="t('settings.general.lastOneUsed')" />
        <ModelSelectPlus class="model" v-model="model" @change="onChangeModel" :engine="engine" :default-text="!models.length ? t('settings.general.lastOneUsed') : ''" />
      </div>
      <div class="group localeUI">
        <label>{{ t('settings.general.localeUI') }}</label>
        <LangSelect v-model="localeUI" default-text="common.language.system" :filter="locales" @change="save" />
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
      <div class="group reset-tips">
        <label>{{ t('settings.general.resetTips') }}</label>
        <button @click.prevent="onResetTips">{{ t('common.reset') }}</button>
      </div>
      <div class="group horizontal run-at-login">
        <input type="checkbox" v-model="runAtLogin" @change="save" />
        <label>{{ t('settings.general.runAtLogin') }}</label>
      </div>
      <div class="group horizontal hide-on-startup">
        <input type="checkbox" v-model="hideOnStartup" @change="save" />
        <label>{{ t('settings.general.hideOnStartup') }}</label>
      </div>
      <div class="group horizontal keep-running">
        <input type="checkbox" v-model="keepRunning" @change="save" />
        <label>{{ t('settings.general.keepInStatusBar') }}</label>
      </div>
    </main>
  </form>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { store } from '../services/store'
import { t, hasLocalization } from '../services/i18n'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelectPlus from '../components/ModelSelectPlus.vue'
import LangSelect from '../components/LangSelect.vue'

const engine = ref(null)
const model = ref(null)
const locales = ref([])
const localeUI = ref(null)
const localeLLM = ref(null)
const isLocalized = ref(false)
const forceLocale = ref(false)
const runAtLogin = ref(false)
const hideOnStartup = ref(false)
const keepRunning = ref(false)

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
  engine.value = store.config.prompt.engine || ''
  model.value = store.config.prompt.model || ''
  locales.value = Object.keys(window.api.config.getI18nMessages())
  localeUI.value = store.config.general.locale
  localeLLM.value = store.config.llm.locale
  forceLocale.value = store.config.llm.forceLocale
  runAtLogin.value = window.api.runAtLogin.get()
  hideOnStartup.value = store.config.general.hideOnStartup
  keepRunning.value = store.config.general.keepRunning
  onChangeLocaleLLM()
}

const onResetTips = () => {
  store.config.general.tips = {}
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

const save = () => {
  store.config.prompt.engine = engine.value
  store.config.prompt.model = model.value
  store.config.general.locale = localeUI.value
  store.config.llm.locale = localeLLM.value
  store.config.llm.forceLocale = forceLocale.value
  window.api.runAtLogin.set(runAtLogin.value)
  store.config.general.hideOnStartup = hideOnStartup.value
  store.config.general.keepRunning = keepRunning.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>

<style scoped>

dialog.settings .content {
  width: 480px;
}

form .group label {
  min-width: 170px;
}

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