<template>
  <div class="content">
    <div class="group">
      <label>{{ t('settings.shortcuts.newPrompt') }}</label>
      <InputShortcut v-model="prompt" @change="save" />
    </div>
    <div class="group">
      <label>{{ t('settings.shortcuts.newChat') }}</label>
      <InputShortcut v-model="chat" @change="save "/>
    </div>
    <div class="group">
      <label>{{ t('settings.shortcuts.newScratchpad') }}</label>
      <InputShortcut v-model="scratchpad" @change="save "/>
    </div>
    <div class="group">
      <label>{{ t('settings.shortcuts.aiCommands') }}</label>
      <div class="subgroup">
        <InputShortcut v-model="command" @change="save" />
        <span>{{ t('settings.shortcuts.aiCommandsUsage') }}</span>
      </div>
    </div>
    <div class="group">
      <label>{{ t('settings.shortcuts.readAloud') }}</label>
      <div class="subgroup">
        <InputShortcut v-model="readaloud" @change="save" />
        <span>{{ t('settings.shortcuts.readAloudUsage') }}</span>
      </div>
    </div>
    <div class="group">
      <label>{{ t('settings.shortcuts.dictation') }}</label>
      <InputShortcut v-model="transcribe" @change="save" />
    </div>
    <div class="group">
      <label>{{ t('settings.shortcuts.voiceMode') }}</label>
      <InputShortcut v-model="realtime" @change="save" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref } from 'vue'
import { store } from '../services/store'
import InputShortcut from '../components/InputShortcut.vue'

const prompt = ref(null)
const chat = ref(null)
const scratchpad = ref(null)
const command = ref(null)
const readaloud = ref(null)
const transcribe = ref(null)
const realtime = ref(null)

const load = () => {
  prompt.value = store.config.shortcuts.prompt
  chat.value = store.config.shortcuts.chat
  scratchpad.value = store.config.shortcuts.scratchpad
  command.value = store.config.shortcuts.command
  readaloud.value = store.config.shortcuts.readaloud
  transcribe.value = store.config.shortcuts.transcribe
  realtime.value = store.config.shortcuts.realtime
}

const save = () => {
  store.config.shortcuts.prompt = prompt.value
  store.config.shortcuts.chat = chat.value
  store.config.shortcuts.scratchpad = scratchpad.value
  store.config.shortcuts.command = command.value
  store.config.shortcuts.readaloud = readaloud.value
  store.config.shortcuts.transcribe = transcribe.value
  store.config.shortcuts.realtime = realtime.value
  store.saveSettings()
  window.api.shortcuts.register()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>
