<template>
  <div class="tab-content">
    <header>
      <div class="title">{{ t('settings.tabs.shortcuts') }}</div>
    </header>
    <main class="form form-large">
      <div class="form-field">
        <label>{{ t('settings.shortcuts.mainWindow') }}</label>
        <InputShortcut v-model="chat" @change="save "/>
      </div>
      <div class="form-field">
        <label>{{ t('settings.shortcuts.quickPrompt') }}</label>
        <InputShortcut v-model="prompt" @change="save" />
      </div>
      <div class="form-field">
        <label>{{ t('settings.shortcuts.scratchpad') }}</label>
        <InputShortcut v-model="scratchpad" @change="save "/>
      </div>
      <div class="form-field">
        <label>{{ t('settings.shortcuts.aiCommands') }}</label>
        <InputShortcut v-model="command" @change="save" />
      </div>
      <div class="form-field">
        <span>{{ t('settings.shortcuts.aiCommandsUsage') }}</span>
      </div>
      <div class="form-field">
        <label>{{ t('settings.shortcuts.designStudio') }}</label>
        <InputShortcut v-model="studio" @change="save" />
      </div>
      <div class="form-field">
        <label>{{ t('settings.shortcuts.readAloud') }}</label>
        <InputShortcut v-model="readaloud" @change="save" />
      </div>
      <div class="form-field">
        <span>{{ t('settings.shortcuts.readAloudUsage') }}</span>
      </div>
      <div class="form-field">
        <label>{{ t('settings.shortcuts.dictation') }}</label>
        <InputShortcut v-model="dictation" @change="save" />
      </div>
      <div class="form-field">
        <label>{{ t('settings.shortcuts.audioBooth') }}</label>
        <InputShortcut v-model="audioBooth" @change="save" />
      </div>
      <div class="form-field">
        <label>{{ t('settings.shortcuts.voiceMode') }}</label>
        <InputShortcut v-model="realtime" @change="save" />
      </div>
      <div class="form-field">
        <label></label>
        <button class="clear-all" @click="clearAll">{{ t('settings.shortcuts.clearAll') }}</button>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'
import InputShortcut from '@components/InputShortcut.vue'

const prompt = ref(null)
const chat = ref(null)
const scratchpad = ref(null)
const command = ref(null)
const readaloud = ref(null)
const dictation = ref(null)
const audioBooth = ref(null)
const realtime = ref(null)
const studio = ref(null)

const load = () => {
  prompt.value = store.config.shortcuts.prompt
  chat.value = store.config.shortcuts.main
  scratchpad.value = store.config.shortcuts.scratchpad
  command.value = store.config.shortcuts.command
  readaloud.value = store.config.shortcuts.readaloud
  dictation.value = store.config.shortcuts.dictation
  audioBooth.value = store.config.shortcuts.audioBooth
  realtime.value = store.config.shortcuts.realtime
  studio.value = store.config.shortcuts.studio
}

const clearAll = () => {
  prompt.value = null
  chat.value = null
  scratchpad.value = null
  command.value = null
  readaloud.value = null
  dictation.value = null
  audioBooth.value = null
  realtime.value = null
  studio.value = null
  save()
}

const save = () => {
  store.config.shortcuts.prompt = prompt.value
  store.config.shortcuts.main = chat.value
  store.config.shortcuts.scratchpad = scratchpad.value
  store.config.shortcuts.command = command.value
  store.config.shortcuts.readaloud = readaloud.value
  store.config.shortcuts.dictation = dictation.value
  store.config.shortcuts.audioBooth = audioBooth.value
  store.config.shortcuts.realtime = realtime.value
  store.config.shortcuts.studio = studio.value
  store.saveSettings()
  window.api.shortcuts.register()
}

defineExpose({ load })

</script>


<style scoped>

.tab-content:deep() {

  --label-width: 190px;

  max-width: 600px;

  .form-field {

    align-items: center;

    label {
      margin-top: 0rem;
      width: var(--label-width);
      font-weight: bold;
    }
    &:not(:has(label)) {
      margin-top: -0.25rem;
      padding-left: calc(var(--label-width) + 0.5rem);
      span {
        width: 220px
      }
    }
    label + * {
      width: 150px !important;
    }

    .form-subgroup {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    button {
      height: 32px;
    }

    button.clear-all {
      width: auto !important;
      padding: 0.5rem 0.75rem;
      white-space: nowrap;
    }
  }
}

</style>
