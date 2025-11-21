<template>
  <div class="tab-content">
    <header>
      <div class="title">{{ t('settings.tabs.plugins') }}</div>
    </header>
    <main class="form form-vertical form-large">
      <div class="master-detail">
        <div class="md-master">
          <div class="md-master-list">
            <div class="md-master-list-item" v-for="plugin in plugins" :key="plugin.id" :class="{ selected: currentPlugin == plugin.id }" :data-id="plugin.id" @click="selectPlugin(plugin)">
              <PluginIcon :tool="plugin.id" class="logo icon"/>
              {{ plugin.label }}
            </div>
          </div>
        </div>
        <component :is="currentView" class="md-detail" ref="pluginSettings" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">

import { computed, nextTick, ref } from 'vue'
import PluginIcon from '../components/PluginIcon.vue'
import { availablePlugins } from '@services/plugins/plugins'
import { t } from '@services/i18n'
import SettingsBrowse from './SettingsBrowse.vue'
import SettingsFilesystem from './SettingsFilesystem.vue'
import SettingsImage from './SettingsImage.vue'
import SettingsKnowledge from './SettingsKnowledge.vue'
import SettingsMemory from './SettingsMemory.vue'
import SettingsPython from './SettingsPython.vue'
import SettingsSearch from './SettingsSearch.vue'
import SettingsVega from './SettingsVega.vue'
import SettingsVideo from './SettingsVideo.vue'
import SettingsYouTube from './SettingsYouTube.vue'

const currentPlugin = ref(Object.keys(availablePlugins)[0])
const pluginSettings = ref(null)

type PluginUI = {
  id: string,
  label: string,
}

const plugins = computed((): PluginUI[] => {

  let res = Object.keys(availablePlugins).filter(plugin => plugin != 'mcp').map(plugin => {
    return {
      id: plugin,
      label: t(`settings.plugins.${plugin}.title`),
    }
  })
  return res
})

const currentView = computed(() => {
  if (currentPlugin.value == 'browse') return SettingsBrowse
  if (currentPlugin.value == 'python') return SettingsPython
  if (currentPlugin.value == 'search') return SettingsSearch
  if (currentPlugin.value == 'image') return SettingsImage
  if (currentPlugin.value == 'video') return SettingsVideo
  if (currentPlugin.value == 'youtube') return SettingsYouTube
  if (currentPlugin.value == 'memory') return SettingsMemory
  if (currentPlugin.value == 'vega') return SettingsVega
  if (currentPlugin.value == 'filesystem') return SettingsFilesystem
  if (currentPlugin.value == 'knowledge') return SettingsKnowledge
})

const selectPlugin = (plugin: PluginUI) => {
  currentPlugin.value = plugin.id
  nextTick(() => pluginSettings.value.load())
}

const load = () => {
  pluginSettings.value.load()
}

const save = () => {
}

defineExpose({ load })

</script>

