<template>
  <div class="settings panel-content tabs" ref="tabs">
    <div class="panel">
      <header>
        <div class="title">{{ t('common.settings') }}</div>
      </header>
      <main>
        <ul>
          <SettingsTab class="general" :title="t('settings.tabs.general')" :checked="initialTab == 'general'"><BIconGear class="icon" /></SettingsTab>
          <SettingsTab class="llm" :title="t('settings.tabs.llm')" :checked="initialTab == 'llm'"><BIconBox class="icon" /></SettingsTab>
          <SettingsTab class="chat" :title="t('settings.tabs.chat')"><BIconLayoutTextWindowReverse class="icon" /></SettingsTab>
          <SettingsTab v-if="enableDeepResearch" class="deepresearch" :title="t('settings.tabs.deepResearch')" :checked="initialTab == 'deepresearch'"><BIconBinoculars class="icon" /></SettingsTab>
          <SettingsTab class="models" :title="t('settings.tabs.models')" :checked="initialTab == 'models'"><BIconCpu class="icon" /></SettingsTab>
          <SettingsTab class="plugins" :title="t('settings.tabs.plugins')" :checked="initialTab == 'plugins'"><BIconTools class="icon" /></SettingsTab>
          <SettingsTab class="mcp" :title="t('settings.tabs.mcp')" @change="load(settingsMcp)" :checked="initialTab == 'mcp'"><WIconMcp class="icon" /></SettingsTab>
          <SettingsTab class="commands" :title="t('settings.tabs.commands')" @change="load(settingsCommands)" :checked="initialTab == 'commands'"><BIconMagic class="icon" /></SettingsTab>
          <SettingsTab class="experts" :title="t('settings.tabs.experts')" @change="load(settingsExperts)" :checked="initialTab == 'experts'"><BIconMortarboard class="icon" /></SettingsTab>
          <SettingsTab class="voice" :title="t('settings.tabs.voice')" :checked="initialTab == 'voice'"><BIconMegaphone class="icon" /></SettingsTab>
          <SettingsTab class="shortcuts" :title="t('settings.tabs.shortcuts')" :checked="initialTab == 'shortcuts'"><BIconCommand class="icon" /></SettingsTab>
          <SettingsTab class="advanced" :title="t('settings.tabs.advanced')" @change="load(settingsAdvanced)" :checked="initialTab == 'advanced'"><BIconTools class="icon" /></SettingsTab>
        </ul>
      </main>
  </div>
    <div class="content">
      <SettingsGeneral ref="settingsGeneral" />
      <SettingsLLM ref="settingsLLM" />
      <SettingsChat ref="settingsChat" />
      <SettingsDeepResearch v-if="enableDeepResearch" ref="settingsDeepResearch" />
      <SettingsModels ref="settingsModels" />
      <SettingsPlugins ref="settingsPlugins" />
      <SettingsMcp ref="settingsMcp" />
      <SettingsCommands ref="settingsCommands" />
      <SettingsExperts ref="settingsExperts" />
      <SettingsVoice ref="settingsVoice" />
      <SettingsShortcuts ref="settingsShortcuts" />
      <SettingsAdvanced ref="settingsAdvanced" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { OpenSettingsPayload } from '../types/index'
import { MenuBarMode } from '../components/MenuBar.vue'
import { ref, onMounted, watch, nextTick, PropType, computed } from 'vue'
import { store } from '../services/store' 
import { t } from '../services/i18n'
import SettingsTab from '../settings/SettingsTab.vue'
import SettingsGeneral from '../settings/SettingsGeneral.vue'
import SettingsLLM from '../settings/SettingsLLM.vue'
import SettingsChat from '../settings/SettingsChat.vue'
import SettingsDeepResearch from '../settings/SettingsDeepResearch.vue'
import SettingsCommands from '../settings/SettingsCommands.vue'
import SettingsExperts from '../settings/SettingsExperts.vue'
import SettingsShortcuts from '../settings/SettingsShortcuts.vue'
import SettingsModels from '../settings/SettingsModels.vue'
import SettingsPlugins from '../settings/SettingsPlugins.vue'
import SettingsMcp from '../settings/SettingsMcp.vue'
import SettingsVoice from '../settings/SettingsVoice.vue'
import SettingsAdvanced from '../settings/SettingsAdvanced.vue'
import WIconMcp from '../../assets/mcp.svg?component'
import { installTabs, showActiveTab } from '../composables/tabs'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

const props = defineProps({
  extra: {
    type: Object as PropType<OpenSettingsPayload>,
    default: {
      initialTab: 'general'
    }
  }
})

const tabs = ref<HTMLElement>(null)
const initialTab = ref('general')
const settingsGeneral = ref(null)
const settingsLLM = ref(null)
const settingsChat = ref(null)
const settingsDeepResearch = ref(null)
const settingsModels = ref(null)
const settingsPlugins = ref(null)
const settingsMcp = ref(null)
const settingsCommands = ref(null)
const settingsExperts = ref(null)
const settingsVoice = ref(null)
const settingsShortcuts = ref(null)
const settingsAdvanced = ref(null)

const settings = [
  settingsGeneral,
  settingsLLM,
  settingsChat,
  settingsDeepResearch,
  settingsModels,
  settingsPlugins,
  settingsMcp,
  settingsCommands,
  settingsExperts,
  settingsVoice,
  settingsShortcuts,
  settingsAdvanced
]

const enableDeepResearch = computed(() => {
  return store.config.features?.deepResearch
})

onMounted(async () => {

  // watch props for changes
  watch(() => props.extra, (params) => {
    if (params?.initialTab) {
      showTab(params.initialTab)
      if (params.initialTab === 'models' && params.engine) {
        settingsModels.value?.load({ engine: params.engine })
      }
      if (params.initialTab === 'voice' && params.engine) {
        settingsVoice.value?.load({ engine: params.engine })
      }
    }
  }, { immediate: true })

  // reload
  window.api.on('file-modified', (file: string) => {
    if (file === 'settings') {
      for (const setting of settings) {
        setting.value.load()
      }
    }
  })

  // tabs
  installTabs(tabs.value)
  showActiveTab(tabs.value)

  // events
  onEvent('main-view-changed', (mode: MenuBarMode) => {
    if (mode === 'settings') {
      onOpenSettings()
    }
  })

  // load
  onOpenSettings(props.extra)

})

const showTab = (tab: string) => {
  const el = document.querySelector<HTMLElement>(`.settings .tab.${tab} input`)
  if (el) {
    el.click()
  }
}

const onOpenSettings = (payload?: OpenSettingsPayload) => {

  // load all panels
  for (const setting of settings) {
    setting.value?.load(payload)
  }

  // show
  showActiveTab(tabs.value)

  // show initial tab
  nextTick(() => {
    if (payload?.initialTab) {
      showTab(payload.initialTab)
    }
  })

}

const load = (tab: any) => {
  tab.load()
}

</script>

<style scoped>
@import '../../css/panel-content.css';
@import '../../css/form.css';
</style>

<style>
@import '../../css/settings.css';
</style>
