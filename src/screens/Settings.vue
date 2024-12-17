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
            <SettingsTab class="experts" title="Experts"><BIconMortarboard class="icon" /></SettingsTab>
            <SettingsTab class="shortcuts" title="Shortcuts"><BIconCommand class="icon" /></SettingsTab>
            <SettingsTab class="models" title="Models" :checked="initialTab == 'models'"><BIconCpu class="icon" /></SettingsTab>
            <SettingsTab class="plugins" title="Plugins" :checked="initialTab == 'plugins'"><BIconTools class="icon" /></SettingsTab>
            <SettingsTab class="voice" title="Voice" :checked="initialTab == 'voice'"><BIconMegaphone class="icon" /></SettingsTab>
            <SettingsTab class="advanced" title="Advanced"><BIconTools class="icon" /></SettingsTab>
          </ul>
          <SettingsGeneral ref="settingsGeneral" />
          <SettingsAppearance ref="settingsAppearance" />
          <SettingsCommands ref="settingsCommands" />
          <SettingsExperts ref="settingsExperts" />
          <SettingsShortcuts ref="settingsShortcuts" />
          <SettingsLLM ref="settingsLLM" />
          <SettingsPlugins ref="settingsPlugins" />
          <SettingsVoice ref="settingsVoice" />
          <SettingsAdvanced ref="settingsAdvanced" />
        </div>
      </main>
    </form>
  </dialog>
</template>

<script setup lang="ts">

import { ref, onMounted } from 'vue'

import DialogHeader from '../components/DialogHeader.vue'
import SettingsTab from '../settings/SettingsTab.vue'
import SettingsGeneral from '../settings/SettingsGeneral.vue'
import SettingsAppearance from '../settings/SettingsAppearance.vue'
import SettingsCommands from '../settings/SettingsCommands.vue'
import SettingsExperts from '../settings/SettingsExperts.vue'
import SettingsShortcuts from '../settings/SettingsShortcuts.vue'
import SettingsLLM from '../settings/SettingsLLM.vue'
import SettingsPlugins from '../settings/SettingsPlugins.vue'
import SettingsVoice from '../settings/SettingsVoice.vue'
import SettingsAdvanced from '../settings/SettingsAdvanced.vue'

import { nextTick } from 'vue'
import { installTabs, showActiveTab } from '../composables/tabs'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

export interface OpenSettingsPayload {
  initialTab: string
  engine?: string
}

const props = defineProps({
  initialTab: {
    type: String,
    default: 'general'
  }
})
const settingsGeneral = ref(null)
const settingsAppearance = ref(null)
const settingsCommands = ref(null)
const settingsExperts = ref(null)
const settingsShortcuts = ref(null)
const settingsLLM = ref(null)
const settingsPlugins = ref(null)
const settingsVoice = ref(null)
const settingsAdvanced = ref(null)

onMounted(async () => {
  window.api.on('show-settings', onOpenSettings)
  onEvent('open-settings', onOpenSettings)
  showActiveTab()
  installTabs()
})

const onOpenSettings = (payload: OpenSettingsPayload) => {

  // load all panels
  settingsGeneral.value.load(payload)
  settingsAppearance.value.load(payload)
  settingsShortcuts.value.load(payload)
  settingsCommands.value.load(payload)
  settingsExperts.value.load(payload)
  settingsLLM.value.load(payload)
  settingsPlugins.value.load(payload)
  settingsVoice.value.load(payload)
  settingsAdvanced.value.load(payload)
  document.querySelector<HTMLDialogElement>('#settings').showModal()
  showActiveTab()

  // show initial tab
  if (payload?.initialTab) {
    nextTick(() => {
      document.querySelector<HTMLElement>(`.settings .tab.${payload.initialTab} input`)?.click()
    })
  }
}

const onClose = () => {
  document.querySelector<HTMLDialogElement>('#settings').close()
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
  padding: 16px 0px 24px 0px;
  min-height: 160px;
}

dialog.settings .tabs .tab>label {
  padding: 8px;
  margin: 0px 2px;
  color: var(--tabs-header-normal-text-color);
}

dialog.settings .tabs .tab>[name="tabs"]:checked+label {
  background-color: var(--tabs-header-selected-bg-color);
  color: var(--tabs-header-selected-text-color);
  border-radius: 8px;
}

dialog.settings .tabs label .icon {
  display: block;
  margin: 0 auto;
  width: 15pt;
  height: 15pt;
  color: var(--tabs-header-normal-text-color);
  filter: invert(48%) sepia(6%) saturate(86%) hue-rotate(349deg) brightness(86%) contrast(90%);
}

@media (prefers-color-scheme: dark) {
  dialog.settings .tabs label .icon {
    filter: invert(81%) sepia(0%) saturate(0%) hue-rotate(323deg) brightness(167%) contrast(170%);
  }
}

dialog.settings .tabs .tab>[name="tabs"]:checked+label .icon {
  color: var(--tabs-header-selected-text-color);
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

dialog.settings .actions {
  margin-top: 8px;
  display: flex;
}

dialog.settings .actions button:first-child {
  margin-left: 0px;
}

dialog.settings .actions .right {
  flex: 1;
  text-align: right;
}

dialog.settings .content:has(.list-panel) {
  width: 100%;
  height: 100%;
  padding: 0px;
}

dialog.settings .list-panel {

  display: flex;
  flex-direction: row;
  align-items: stretch;

  .list {
  
    background-color: var(--sidebar-bg-color);
    border-right: 0.5px solid var(--dialog-separator-color);
    width: 140px;
    padding: 10px;

    .item {
      flex-direction: row;
      align-items: center;
      height: 24px;
      padding: 0px 8px;
      margin: 2px 0px;
      display: flex;
      border-radius: 4px;
      font-size: 10.5pt;

      .logo {
        height: 10pt;
        margin-right: 4px;
      }

      .icon {
        color: var(--text-color);
      }

      &.selected {
        background-color: var(--highlight-color);
        color: var(--highlighted-color);
        .icon {
          color: var(--highlighted-color);
        }
        .image {
          filter: invert(1);
        }
      }
    }
  }

  .panel {
    flex: 1;
    min-height: 200px;
    padding: 16px 16px 16px 0px !important;
  }

}

@media (prefers-color-scheme: dark) {
  dialog.settings .list-panel .list .item .image {
    filter: invert(1);
  }
}

</style>