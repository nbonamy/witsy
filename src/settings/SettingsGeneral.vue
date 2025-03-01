<template>
  <div class="content">
    <div class="group prompt">
      <label>{{ t('settings.general.promptLLMModel') }}</label>
      <EngineSelect class="engine" v-model="engine" @change="onChangeEngine" :default-text="t('settings.general.lastOneUsed')" />&nbsp;
      <ModelSelect class="model" v-model="model" @change="onChangeModel" :engine="engine" :default-text="!models.length ? t('settings.general.lastOneUsed') : ''" />
    </div>
    <div class="group localeUI">
      <label>{{ t('settings.general.localeUI') }}</label>
      <select v-model="localeUI" @change="save">
        <option value="">{{ t('common.language.system') }}</option>
        <option value="en">🇬🇧 English</option>
        <option value="fr">🇫🇷 Français</option>
      </select>
    </div>
    <div class="group localeLlm">
      <label>{{ t('settings.general.localeLlm') }}</label>
      <LangSelect v-model="localeLlm" @change="save" />
    </div>
    <div class="group reset-tips">
      <label>{{ t('settings.general.resetTips') }}</label>
      <button @click.prevent="onResetTips">{{ t('common.reset') }}</button>
    </div>
    <div class="group run-at-login">
      <label>{{ t('settings.general.runAtLogin') }}</label>
      <input type="checkbox" v-model="runAtLogin" @change="save" />
    </div>
    <div class="group hide-on-startup">
      <label>{{ t('settings.general.hideOnStartup') }}</label>
      <input type="checkbox" v-model="hideOnStartup" @change="save" />
    </div>
    <div class="group keep-running">
      <label>{{ t('settings.general.keepInStatusBar') }}</label>
      <input type="checkbox" v-model="keepRunning" @change="save" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, computed } from 'vue'
import { store } from '../services/store'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import LangSelect from '../components/LangSelect.vue'

const engine = ref(null)
const model = ref(null)
const localeUI = ref(null)
const localeLlm = ref(null)
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
  localeUI.value = store.config.general.locale
  localeLlm.value = store.config.llm.locale
  runAtLogin.value = window.api.runAtLogin.get()
  hideOnStartup.value = store.config.general.hideOnStartup
  keepRunning.value = store.config.general.keepRunning
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

const save = () => {
  store.config.prompt.engine = engine.value
  store.config.prompt.model = model.value
  store.config.general.locale = localeUI.value
  store.config.llm.locale = localeLlm.value
  window.api.runAtLogin.set(runAtLogin.value)
  store.config.general.hideOnStartup = hideOnStartup.value
  store.config.general.keepRunning = keepRunning.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>

<style scoped>
form .group label {
  min-width: 170px;
}
</style>