<template>
  <div class="settings split-pane tabs" ref="tabs">
    <div class="sp-sidebar">
      <header>
        <div class="title">{{ t('common.settings') }}</div>
      </header>
      <main>
        <ul>
          <SettingsTab class="general" :title="t('settings.tabs.general')" @change="load(settingsGeneral)" :checked="initialTab == 'general'"><AppWindowMacIcon class="icon" /></SettingsTab>
          <SettingsTab class="sidebar" :title="t('settings.tabs.sidebar')" @change="load(settingsSidebar)" :checked="initialTab == 'sidebar'" v-if="store.isFeatureEnabled('webapps')"><PanelsTopLeftIcon class="icon" /></SettingsTab>
          <SettingsTab class="llm" :title="t('settings.tabs.llm')" @change="load(settingsLLM)" :checked="initialTab == 'llm'"><BoxIcon class="icon" /></SettingsTab>
          <SettingsTab class="favorites" :title="t('settings.tabs.favorites')" @change="load(settingsFavorites)" :checked="initialTab == 'favorites'"><StarIcon class="icon" /></SettingsTab>
          <SettingsTab class="chat" :title="t('settings.tabs.chat')" @change="load(settingsChat)"><AppWindowIcon class="icon" /></SettingsTab>
          <SettingsTab class="deepresearch" :title="t('settings.tabs.deepResearch')" @change="load(settingsDeepResearch)" :checked="initialTab == 'deepresearch'"><TelescopeIcon class="icon" /></SettingsTab>
          <SettingsTab class="models" :title="t('settings.tabs.models')" @change="load(settingsModels)" :checked="initialTab == 'models'"><BoxIcon class="icon" /></SettingsTab>
          <SettingsTab class="plugins" :title="t('settings.tabs.plugins')" @change="load(settingsPlugins)" :checked="initialTab == 'plugins'"><Plug2Icon class="icon" /></SettingsTab>
          <SettingsTab class="commands" :title="t('settings.tabs.commands')" @change="load(settingsCommands)" :checked="initialTab == 'commands'"><WandIcon class="icon" /></SettingsTab>
          <SettingsTab class="experts" :title="t('settings.tabs.experts')" @change="load(settingsExperts)" :checked="initialTab == 'experts'"><BrainIcon class="icon" /></SettingsTab>
          <SettingsTab class="voice" :title="t('settings.tabs.voice')" @change="load(settingsVoice)" :checked="initialTab == 'voice'"><MicIcon class="icon" /></SettingsTab>
          <SettingsTab class="shortcuts" :title="t('settings.tabs.shortcuts')" @change="load(settingsShortcuts)" :checked="initialTab == 'shortcuts'"><CommandIcon class="icon" /></SettingsTab>
          <SettingsTab class="advanced" :title="t('settings.tabs.advanced')" @change="load(settingsAdvanced)" :checked="initialTab == 'advanced'"><BadgePlusIcon class="icon" /></SettingsTab>
        </ul>
      </main>
  </div>
    <div class="sp-main">
      <SettingsGeneral ref="settingsGeneral" />
      <SettingsSidebar ref="settingsSidebar" v-if="store.isFeatureEnabled('webapps')" />
      <SettingsLLM ref="settingsLLM" />
      <SettingsFavorites ref="settingsFavorites" />
      <SettingsChat ref="settingsChat" />
      <SettingsDeepResearch ref="settingsDeepResearch" />
      <SettingsModels ref="settingsModels" />
      <SettingsPlugins ref="settingsPlugins" />
      <SettingsCommands ref="settingsCommands" />
      <SettingsExperts ref="settingsExperts" />
      <SettingsVoice ref="settingsVoice" />
      <SettingsShortcuts ref="settingsShortcuts" />
      <SettingsAdvanced ref="settingsAdvanced" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { AppWindowIcon, AppWindowMacIcon, BadgePlusIcon, BoxIcon, BrainIcon, CommandIcon, MicIcon, PanelsTopLeftIcon, Plug2Icon, StarIcon, TelescopeIcon, WandIcon } from 'lucide-vue-next'
import { nextTick, onMounted, PropType, ref, watch } from 'vue'
import { MenuBarMode } from '@components/MenuBar.vue'
import useEventBus from '@composables/event_bus'
import { installTabs, showActiveTab } from '@renderer/utils/tabs'
import { t } from '@services/i18n'
import { store } from '@services/store'
import SettingsAdvanced from '../settings/SettingsAdvanced.vue'
import SettingsChat from '../settings/SettingsChat.vue'
import SettingsCommands from '../settings/SettingsCommands.vue'
import SettingsDeepResearch from '../settings/SettingsDeepResearch.vue'
import SettingsExperts from '../settings/SettingsExperts.vue'
import SettingsFavorites from '../settings/SettingsFavorites.vue'
import SettingsGeneral from '../settings/SettingsGeneral.vue'
import SettingsLLM from '../settings/SettingsLLM.vue'
import SettingsModels from '../settings/SettingsModels.vue'
import SettingsPlugins from '../settings/SettingsPlugins.vue'
import SettingsShortcuts from '../settings/SettingsShortcuts.vue'
import SettingsSidebar from '../settings/SettingsSidebar.vue'
import SettingsTab from '../settings/SettingsTab.vue'
import SettingsVoice from '../settings/SettingsVoice.vue'
import { OpenSettingsPayload } from 'types/index'

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
const settingsFavorites = ref(null)
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
const settingsSidebar = ref(null)
const activeTab = ref(null)

const settings = [
  settingsGeneral,
  settingsLLM,
  settingsFavorites,
  settingsChat,
  settingsDeepResearch,
  settingsModels,
  settingsPlugins,
  settingsMcp,
  settingsCommands,
  settingsExperts,
  settingsVoice,
  settingsShortcuts,
  settingsAdvanced,
  settingsSidebar
]

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
        setting.value?.load()
      }
    }
  })

  // tabs
  installTabs(tabs.value)
  showActiveTab(tabs.value)

  // events
  onEvent('main-view-changed', (mode: MenuBarMode) => {
    if (mode === 'settings') {
      onShow()
    }
  })

  // initial load (data only, not show)
  for (const setting of settings) {
    setting.value?.load()
  }

})

const showTab = (tab: string) => {
  const el = document.querySelector<HTMLElement>(`.settings .tab.${tab} input`)
  if (el) {
    el.click()
  }
}

const onShow = (payload?: OpenSettingsPayload) => {
  // show active tab
  showActiveTab(tabs.value)

  // show initial tab if specified
  if (payload?.initialTab) {
    nextTick(() => showTab(payload.initialTab))
  }

  // notify active tab it's visible
  activeTab.value?.onShow?.()
}

const onHide = () => {
  activeTab.value?.onHide?.()
}

const load = (tab: any) => {
  // hide previous tab
  activeTab.value?.onHide?.()
  // set and show new tab
  activeTab.value = tab
  tab.load()
  tab.onShow?.()
}

defineExpose({ onShow, onHide })

</script>
