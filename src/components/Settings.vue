<template>
  <dialog>
    <form method="dialog">
      <header>Settings</header>
      <main>
        <div class="tabs">
          <ul>
            <SettingsTab title="General" :checked="true"><BIconGear class="icon" /></SettingsTab>
            <SettingsTab title="Appearance"><BIconPalette class="icon" /></SettingsTab>
            <SettingsTab title="OpenAI"><EngineLogo engine="openai" class="icon" /></SettingsTab>
            <SettingsTab title="Ollama"><EngineLogo engine="ollama" class="icon" /></SettingsTab>
          </ul>
          <SettingsGeneral class="content" ref="settingsGeneral" />
          <SettingsAppearance class="content" ref="settingsAppearance" />
          <SettingsOpenAI class="content" ref="settingsOpenAI" />
          <SettingsOllama class="content" ref="settingsOllama" />
        </div>
      </main>
      <footer>
        <button @click="onSave" class="default">Save</button>
        <button class="destructive">Cancel</button>
      </footer>
    </form>
  </dialog>
</template>

<script setup>

import { ref, onMounted } from 'vue'
import { store } from '../services/store'
import EngineLogo from './EngineLogo.vue'

import SettingsTab from './SettingsTab.vue'
import SettingsGeneral from './SettingsGeneral.vue'
import SettingsAppearance from './SettingsAppearance.vue'
import SettingsOpenAI from './SettingsOpenAI.vue'
import SettingsOllama from './SettingsOllama.vue'

// bus
import useEventBus from '../composables/useEventBus'
const { onEvent } = useEventBus()

const settingsGeneral = ref(null)
const settingsAppearance = ref(null)
const settingsOpenAI = ref(null)
const settingsOllama = ref(null)

onMounted(async () => {
  onEvent('openSettings', onOpenSettings)
  showActiveTab()
  installTabs()
})

const onOpenSettings = () => {
  settingsGeneral.value.load()
  settingsAppearance.value.load()
  settingsOpenAI.value.load()
  settingsOllama.value.load()
  document.querySelector('#settings').showModal()
}

const onSave = () => {
  settingsGeneral.value.save()
  settingsAppearance.value.save()
  settingsOpenAI.value.save()
  settingsOllama.value.save()
  store.save()
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>

<style>
dialog {
  width: 500px;
}

.tabs .tab>label {
  padding: 8px;
  margin: 0px 2px;
}

.tabs .tab>[name="tabs"]:checked+label {
  background-color: #e5e6e6;
  border-radius: 8px;
}

.tabs label .icon {
  display: block;
  margin: 0 auto;
  width: 15pt;
  height: 15pt;
  color: var(--tabs-header-normal-color);
  filter: invert(48%) sepia(6%) saturate(86%) hue-rotate(349deg) brightness(86%) contrast(90%);
}

.tabs .tab>[name="tabs"]:checked+label .icon {
  color: var(--tabs-header-selected-color);
  /* calculated using https://codepen.io/sosuke/pen/Pjoqqp */
  filter: invert(25%) sepia(97%) saturate(3446%) hue-rotate(208deg) brightness(97%) contrast(98%);
}

.tabs label .title {
  font-size: 9pt;
}

.tabs .content {
  padding: 16px 32px;
  height: 150px;
}

.fontsize {
  display: inline-block;
  margin: 0 8px;
}

.fontsize.small {
  font-size: 8pt;
}

.fontsize.large {
  font-size: 12pt;
}
textarea {
  height: 50px;
  resize: none;
}
</style>