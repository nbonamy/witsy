
<template>
  <div class="content">
    <div class="group engine">
      <label>LLM engine</label>
      <EngineSelect v-model="llmEngine" @change="save" />
    </div>
    <div class="group language">
      <label>Answer in</label>
      <LangSelect v-model="language" @change="save" />
    </div>
    <div class="group reset-tips">
      <label>Reset tips</label>
      <button @click.prevent="onResetTips">Reset</button>
    </div>
    <div class="group run-at-login">
      <label>Run at login</label>
      <input type="checkbox" v-model="runAtLogin" @change="save" />
    </div>
    <div class="group hide-on-startup">
      <label>Hide chat on start</label>
      <input type="checkbox" v-model="hideOnStartup" @change="save" />
    </div>
    <div class="group keep-running">
      <label>Keep in Status Bar</label>
      <input type="checkbox" v-model="keepRunning" @change="save" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import EngineSelect from '../components/EngineSelect.vue'
import LangSelect from '../components/LangSelect.vue'


const llmEngine = ref(null)
const language = ref(null)
const runAtLogin = ref(false)
const hideOnStartup = ref(false)
const keepRunning = ref(false)

const load = () => {
  llmEngine.value = store.config.llm.engine || 'openai'
  language.value = store.config.general.language
  runAtLogin.value = window.api.runAtLogin.get()
  hideOnStartup.value = store.config.general.hideOnStartup
  keepRunning.value = store.config.general.keepRunning
}

const onResetTips = () => {
  store.config.general.tips = {}
  store.saveSettings()
}

const save = () => {
  store.config.llm.engine = llmEngine.value
  store.config.general.language = language.value
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
