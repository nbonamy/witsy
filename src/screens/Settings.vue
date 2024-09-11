<template>
  <dialog class="settings">
    <form method="dialog">
      <DialogHeader title="Settings" @close="onClose" />
      <main>
        <div class="tabs">
          <ul>
            <SettingsTab class="general" title="General" :checked="initialTab == 'general'"><BIconGear class="icon" /></SettingsTab>
            <SettingsTab class="appearance" title="Appearance"><BIconPalette class="icon" /></SettingsTab>
            <SettingsTab class="commands" title="Commands"><BIconMagic class="icon" /></SettingsTab>
            <SettingsTab class="experts" title="Experts"><BIconPersonVcard class="icon" /></SettingsTab>
            <SettingsTab class="shortcuts" title="Shortcuts"><BIconCommand class="icon" /></SettingsTab>
            <SettingsTab class="models" title="Models" :checked="initialTab == 'models'"><BIconCpu class="icon" /></SettingsTab>
            <SettingsTab class="plugins" title="Plugins" :checked="initialTab == 'plugins'"><BIconTools class="icon" /></SettingsTab>
            <SettingsTab class="tts" title="TTS" :checked="initialTab == 'tts'"><BIconMegaphone class="icon" /></SettingsTab>
            <SettingsTab class="advanced" title="Advanced"><BIconTools class="icon" /></SettingsTab>
          </ul>
          <SettingsGeneral ref="settingsGeneral" />
          <SettingsAppearance ref="settingsAppearance" />
          <SettingsCommands ref="settingsCommands" />
          <SettingsPrompts ref="settingsPrompts" />
          <SettingsShortcuts ref="settingsShortcuts" />
          <SettingsLLM ref="settingsLLM" />
          <SettingsPlugins ref="settingsPlugins" />
          <SettingsTTS ref="settingsTTS" />
          <SettingsAdvanced ref="settingsAdvanced" />
        </div>
      </main>
    </form>
  </dialog>
</template>

<script setup>

import { ref, onMounted } from 'vue'

import DialogHeader from '../components/DialogHeader.vue'
import SettingsTab from '../settings/SettingsTab.vue'
import SettingsGeneral from '../settings/SettingsGeneral.vue'
import SettingsAppearance from '../settings/SettingsAppearance.vue'
import SettingsCommands from '../settings/SettingsCommands.vue'
import SettingsPrompts from '../settings/SettingsExperts.vue'
import SettingsShortcuts from '../settings/SettingsShortcuts.vue'
import SettingsLLM from '../settings/SettingsLLM.vue'
import SettingsPlugins from '../settings/SettingsPlugins.vue'
import SettingsTTS from '../settings/SettingsTTS.vue'
import SettingsAdvanced from '../settings/SettingsAdvanced.vue'

import { nextTick } from 'vue'
import { installTabs, showActiveTab } from '../composables/tabs'

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
const settingsPrompts = ref(null)
const settingsShortcuts = ref(null)
const settingsLLM = ref(null)
const settingsPlugins = ref(null)
const settingsTTS = ref(null)
const settingsAdvanced = ref(null)

onMounted(async () => {
  window.api.on('show-settings', onOpenSettings)
  onEvent('openSettings', onOpenSettings)
  showActiveTab()
  installTabs()
})

const onOpenSettings = (payload) => {

  // load all panels
  settingsGeneral.value.load(payload)
  settingsAppearance.value.load(payload)
  settingsShortcuts.value.load(payload)
  settingsCommands.value.load(payload)
  settingsPrompts.value.load(payload)
  settingsLLM.value.load(payload)
  settingsPlugins.value.load(payload)
  settingsTTS.value.load(payload)
  settingsAdvanced.value.load(payload)
  document.querySelector('#settings').showModal()
  showActiveTab()

  // show initial tab
  if (payload?.initialTab) {
    nextTick(() => {
      document.querySelector(`.settings .tab.${payload.initialTab} input`)?.click()
    })
  }
}

const onClose = () => {
  document.querySelector('#settings').close()
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>

<style>

dialog.settings {
  width: 640px;
}

dialog.settings .content {
  width: 440px;
  margin: 0 auto;
  padding: 24px 0px;
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