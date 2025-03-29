<template>
  <div class="window">
    <div class="settings dialog" ref="dialog">
      <form method="dialog">
        <div class="wrapper">
          <DialogHeader :title="t('common.settings')" movable="drag" @close="onClose" />
          <main>
            <div class="tabs">
              <ul>
                <SettingsTab class="general" :title="t('settings.tabs.general')" :checked="initialTab == 'general'"><BIconGear class="icon" /></SettingsTab>
                <SettingsTab class="appearance" :title="t('settings.tabs.appearance')"><BIconPalette class="icon" /></SettingsTab>
                <SettingsTab class="commands" :title="t('settings.tabs.commands')"@change="load(settingsCommands)"><BIconMagic class="icon" /></SettingsTab>
                <SettingsTab class="experts" :title="t('settings.tabs.experts')"@change="load(settingsExperts)"><BIconMortarboard class="icon" /></SettingsTab>
                <SettingsTab class="shortcuts" :title="t('settings.tabs.shortcuts')"><BIconCommand class="icon" /></SettingsTab>
                <SettingsTab class="models" :title="t('settings.tabs.models')" :checked="initialTab == 'models'"><BIconCpu class="icon" /></SettingsTab>
                <SettingsTab class="plugins" :title="t('settings.tabs.plugins')" :checked="initialTab == 'plugins'"><BIconTools class="icon" /></SettingsTab>
                <SettingsTab class="voice" :title="t('settings.tabs.voice')" :checked="initialTab == 'voice'"><BIconMegaphone class="icon" /></SettingsTab>
                <SettingsTab class="advanced" :title="t('settings.tabs.advanced')" @change="load(settingsAdvanced)"><BIconTools class="icon" /></SettingsTab>
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
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">

import { OpenSettingsPayload } from '../types/index'
import { Ref, ref, onMounted, onUnmounted, nextTick, PropType } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
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
import { installTabs, showActiveTab } from '../composables/tabs'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

store.load()

const props = defineProps({
  extra: {
    type: Object as PropType<OpenSettingsPayload>,
    default: {
      initialTab: 'general'
    }
  }
})

const dialog: Ref<HTMLElement> = ref(null)
const initialTab = ref('general')
const settingsGeneral = ref(null)
const settingsAppearance = ref(null)
const settingsCommands = ref(null)
const settingsExperts = ref(null)
const settingsShortcuts = ref(null)
const settingsLLM = ref(null)
const settingsPlugins = ref(null)
const settingsVoice = ref(null)
const settingsAdvanced = ref(null)

const settings = [
  settingsGeneral,
  settingsAppearance,
  settingsCommands,
  settingsExperts,
  settingsShortcuts,
  settingsLLM,
  settingsPlugins,
  settingsVoice,
  settingsAdvanced
]

let observer: MutationObserver|null = null

onMounted(async () => {

  // events
  window.api.on('show', (params: OpenSettingsPayload) => {
    onOpenSettings(params)
  })

  // reload
  window.api.on('file-modified', (file: string) => {
    if (file === 'settings') {
      for (const setting of settings) {
        setting.value.load()
      }
    }
  })

  // load
  onOpenSettings(props.extra)

  // tabs
  installTabs(dialog.value)
  showActiveTab(dialog.value)

  // update height on dom changes
  observer = new MutationObserver(adjustHeight)
  observer.observe(dialog.value, { attributes: true, subtree: true, childList: true })

})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})

const adjustHeight = () => {

  try {

    // get elements
    const form = document.querySelector<HTMLFormElement>('.settings form')
    const wrapper = document.querySelector<HTMLDivElement>('.settings .wrapper')
    if (!form || !wrapper) return

    // adjust height
    const updated = wrapper.offsetHeight
    form.style.height = `${updated}px`

  } catch (e) {
    console.error(e)
  }

}

const onOpenSettings = (payload: OpenSettingsPayload) => {

  // load all panels
  for (const setting of settings) {
    setting.value.load(payload)
  }

  // show
  showActiveTab(dialog.value)

  // show initial tab
  nextTick(() => {
    if (payload?.initialTab) {
      document.querySelector<HTMLElement>(`.settings .tab.${payload.initialTab} input`)?.click()
    }
    adjustHeight()
  })

  //
}

const onClose = () => {
  window.api.settings.close()
}

const load = (tab: any) => {
  tab.load()
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';

.window {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

</style>

<style>

.dialog.settings {
  width: 640px;
}

.dialog.settings form {
  overflow: hidden;
  border-radius: 16px;
  transition: height 150ms ease;
}

.dialog.settings .content {
  width: 440px;
  margin: 0 auto;
  padding: 16px 0px 24px 0px;
  min-height: 240px;

  &.large {
    width: 540px;
  }

  .sticky-table-container {
    height: 200px;
    margin-top: 8px;
    margin-bottom: 8px;
  
    td button {
      font-size: 6pt;
      padding: 2px 8px;
    }
  }

}

.dialog.settings .tabs .tab>label {
  padding: 8px;
  margin: 0px 2px;
  color: var(--tabs-header-normal-text-color);
}

.dialog.settings .tabs .tab>[name="tabs"]:checked+label {
  background-color: var(--tabs-header-selected-bg-color);
  color: var(--tabs-header-selected-text-color);
  border-radius: 8px;
}

.dialog.settings .tabs label .icon {
  display: block;
  margin: 0 auto;
  width: 15pt;
  height: 15pt;
  margin-bottom: 4px;
  color: var(--tabs-header-normal-text-color);
  filter: invert(48%) sepia(6%) saturate(86%) hue-rotate(349deg) brightness(86%) contrast(90%);
}

@media (prefers-color-scheme: dark) {
  .dialog.settings .tabs label .icon {
    filter: invert(81%) sepia(0%) saturate(0%) hue-rotate(323deg) brightness(167%) contrast(170%);
  }
}

.dialog.settings .tabs .tab>[name="tabs"]:checked+label .icon {
  color: var(--tabs-header-selected-text-color);
  /* calculated using https://codepen.io/sosuke/pen/Pjoqqp */
  filter: invert(25%) sepia(97%) saturate(3446%) hue-rotate(208deg) brightness(97%) contrast(98%);
}

.dialog.settings .tabs label .title {
  font-size: 9pt;
}

.dialog.settings textarea {
  height: 50px;
  resize: none;
}

.dialog.settings .actions {
  margin-top: 8px;
  display: flex;
}

.dialog.settings .actions button:first-child {
  margin-left: 0px;
}

.dialog.settings .actions .right {
  flex: 1;
  text-align: right;
}

.dialog.settings .content:has(.list-panel) {
  width: 100%;
  height: 100%;
  padding: 0px;
}

.dialog.settings .list-panel {

  display: flex;
  flex-direction: row;
  align-items: stretch;

  .master {
    padding: 8px;
    background-color: var(--sidebar-bg-color);
    border-right: 0.5px solid var(--dialog-separator-color);
  }

  .master .list {
  
    width: 160px;
    overflow-y: auto;
    padding-right: 0px;
    scrollbar-gutter: stable;
    scrollbar-color: var(--sidebar-scroll-thumb-color) var(--sidebar-bg-color);

    .item {
      flex-direction: row;
      align-items: center;
      height: auto;
      padding: 4px 8px;
      margin: 2px 0px;
      display: flex;
      border-radius: 4px;
      font-size: 10.5pt;

      &:first-child {
        margin-top: 0px;
      }

      &:last-child {
        margin-bottom: 0px;
      }

      .logo {
        height: 10pt;
        margin-right: 6px;
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

  .actions button {
    box-shadow: none;
  }

  .panel {
    flex: 1;
    padding: 8px 16px;
    padding-bottom: 24px;
  }

}

@media (prefers-color-scheme: dark) {
  .dialog.settings .list-panel .list .item .image {
    filter: invert(1);
  }
  .dialog.settings .list-panel .list .item .icon {
    fill: var(--text-color);
  }
}

</style>