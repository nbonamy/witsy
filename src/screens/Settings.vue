<template>
  <dialog class="settings">
    <form method="dialog">
      <header>Settings</header>
      <main>
        <div class="tabs">
          <ul>
            <SettingsTab title="General" :checked="initialTab == 'general'"><BIconGear class="icon" /></SettingsTab>
            <SettingsTab title="Appearance"><BIconPalette class="icon" /></SettingsTab>
            <SettingsTab title="Commands"><BIconMagic class="icon" /></SettingsTab>
            <SettingsTab title="Shortcuts"><BIconCommand class="icon" /></SettingsTab>
            <SettingsTab title="OpenAI" :checked="initialTab == 'openai'"><EngineLogo engine="openai" class="icon" /></SettingsTab>
            <SettingsTab title="Ollama" :checked="initialTab == 'ollama'"><EngineLogo engine="ollama" class="icon" /></SettingsTab>
            <SettingsTab title="Advanced"><BIconTools class="icon" /></SettingsTab>
          </ul>
          <SettingsGeneral ref="settingsGeneral" />
          <SettingsAppearance ref="settingsAppearance" />
          <SettingsCommands ref="settingsCommands" />
          <SettingsShortcuts ref="settingsShortcuts" />
          <SettingsOpenAI ref="settingsOpenAI" />
          <SettingsOllama ref="settingsOllama" />
          <SettingsAdvanced ref="settingsAdvanced" />
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
import EngineLogo from '../components/EngineLogo.vue'

import SettingsTab from '../components/SettingsTab.vue'
import SettingsGeneral from '../components/SettingsGeneral.vue'
import SettingsAppearance from '../components/SettingsAppearance.vue'
import SettingsCommands from '../components/SettingsCommands.vue'
import SettingsShortcuts from '../components/SettingsShortcuts.vue'
import SettingsOpenAI from '../components/SettingsOpenAI.vue'
import SettingsOllama from '../components/SettingsOllama.vue'
import SettingsAdvanced from '../components/SettingsAdvanced.vue'

// bus
import useEventBus from '../composables/useEventBus'
const { onEvent } = useEventBus()

const props = defineProps({
  initialTab: {
    type: String,
    default: 'general'
  }
})
const settingsGeneral = ref(null)
const settingsAppearance = ref(null)
const settingsCommands = ref(null)
const settingsShortcuts = ref(null)
const settingsOpenAI = ref(null)
const settingsOllama = ref(null)
const settingsAdvanced = ref(null)

onMounted(async () => {
  onEvent('openSettings', onOpenSettings)
  showActiveTab()
  installTabs()
})

const onOpenSettings = () => {
  settingsGeneral.value.load()
  settingsAppearance.value.load()
  settingsShortcuts.value.load()
  settingsCommands.value.load()
  settingsOpenAI.value.load()
  settingsOllama.value.load()
  settingsAdvanced.value.load()
  document.querySelector('#settings').showModal()
  showActiveTab()
}

const onSave = () => {
  settingsGeneral.value.save()
  settingsAppearance.value.save()
  settingsCommands.value.save()
  settingsShortcuts.value.save()
  settingsOpenAI.value.save()
  settingsOllama.value.save()
  settingsAdvanced.value.save()
  store.save()
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>

<style>

dialog.settings {
  width: 600px;
}

dialog.settings .content {
  width: 400px;
  margin: 0 auto;
  padding: 16px 0px;
  min-height: 160px;
  max-height: 250px;
}


dialog.settings .tabs .tab>label {
  padding: 8px;
  margin: 0px 2px;
}

dialog.settings .tabs .tab>[name="tabs"]:checked+label {
  background-color: #e5e6e6;
  border-radius: 8px;
}

dialog.settings .tabs label .icon {
  display: block;
  margin: 0 auto;
  width: 15pt;
  height: 15pt;
  color: var(--tabs-header-normal-color);
  filter: invert(48%) sepia(6%) saturate(86%) hue-rotate(349deg) brightness(86%) contrast(90%);
}

dialog.settings .tabs .tab>[name="tabs"]:checked+label .icon {
  color: var(--tabs-header-selected-color);
  /* calculated using https://codepen.io/sosuke/pen/Pjoqqp */
  filter: invert(25%) sepia(97%) saturate(3446%) hue-rotate(208deg) brightness(97%) contrast(98%);
}

dialog.settings .tabs label .title {
  font-size: 9pt;
}

dialog.settings textarea {
  height: 50px;
  resize: none;
}

</style>