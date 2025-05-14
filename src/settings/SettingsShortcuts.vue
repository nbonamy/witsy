<template>
  <form class="tab-content large">
    <header>
      <div class="title">{{ t('settings.tabs.shortcuts') }}</div>
    </header>
    <main>
      <div class="group">
        <label>{{ t('settings.shortcuts.quickPrompt') }}</label>
        <InputShortcut v-model="prompt" @change="save" />
      </div>
      <div class="group">
        <label>{{ t('settings.shortcuts.newChat') }}</label>
        <InputShortcut v-model="chat" @change="save "/>
      </div>
      <div class="group">
        <label>{{ t('settings.shortcuts.scratchpad') }}</label>
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
        <label>{{ t('settings.shortcuts.designStudio') }}</label>
        <div class="subgroup">
          <InputShortcut v-model="studio" @change="save" />
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
    </main>
  </form>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import InputShortcut from '../components/InputShortcut.vue'

const prompt = ref(null)
const chat = ref(null)
const scratchpad = ref(null)
const command = ref(null)
const readaloud = ref(null)
const transcribe = ref(null)
const realtime = ref(null)
const studio = ref(null)

const load = () => {
  prompt.value = store.config.shortcuts.prompt
  chat.value = store.config.shortcuts.chat
  scratchpad.value = store.config.shortcuts.scratchpad
  command.value = store.config.shortcuts.command
  readaloud.value = store.config.shortcuts.readaloud
  transcribe.value = store.config.shortcuts.transcribe
  realtime.value = store.config.shortcuts.realtime
  studio.value = store.config.shortcuts.studio
}

const save = () => {
  store.config.shortcuts.prompt = prompt.value
  store.config.shortcuts.chat = chat.value
  store.config.shortcuts.scratchpad = scratchpad.value
  store.config.shortcuts.command = command.value
  store.config.shortcuts.readaloud = readaloud.value
  store.config.shortcuts.transcribe = transcribe.value
  store.config.shortcuts.realtime = realtime.value
  store.config.shortcuts.studio = studio.value
  store.saveSettings()
  window.api.shortcuts.register()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>

<style scoped>

.settings form .group label {
  font-weight: bold;

  &::after {
    content: '';
  }
}

</style>