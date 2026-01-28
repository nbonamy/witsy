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

import { computed, nextTick, ref, type Component } from 'vue'
import PluginIcon from '@components/PluginIcon.vue'
import { t } from '@services/i18n'
import SettingsBrowse from './SettingsBrowse.vue'
import SettingsFilesystem from './SettingsFilesystem.vue'
import SettingsImage from './SettingsImage.vue'
import SettingsKnowledge from './SettingsKnowledge.vue'
import SettingsMemory from './SettingsMemory.vue'
import SettingsPython from './SettingsPython.vue'
import SettingsSearch from './SettingsSearch.vue'
import SettingsVideo from './SettingsVideo.vue'
import SettingsYouTube from './SettingsYouTube.vue'

type PluginSettingsEntry = {
  labelKey: string
  component: Component
}

const pluginSettingsRegistry: Record<string, PluginSettingsEntry> = {
  knowledge: { labelKey: 'settings.plugins.knowledge.title', component: SettingsKnowledge },
  search: { labelKey: 'settings.plugins.search.title', component: SettingsSearch },
  browse: { labelKey: 'settings.plugins.browse.title', component: SettingsBrowse },
  image: { labelKey: 'settings.plugins.image.title', component: SettingsImage },
  video: { labelKey: 'settings.plugins.video.title', component: SettingsVideo },
  youtube: { labelKey: 'settings.plugins.youtube.title', component: SettingsYouTube },
  python: { labelKey: 'settings.plugins.python.title', component: SettingsPython },
  memory: { labelKey: 'settings.plugins.memory.title', component: SettingsMemory },
  filesystem: { labelKey: 'settings.plugins.filesystem.title', component: SettingsFilesystem },
}

const currentPlugin = ref(Object.keys(pluginSettingsRegistry)[0])
const pluginSettings = ref(null)

type PluginUI = {
  id: string,
  label: string,
}

const plugins = computed((): PluginUI[] => {
  return Object.keys(pluginSettingsRegistry).map(id => ({
    id,
    label: t(pluginSettingsRegistry[id].labelKey),
  }))
})

const currentView = computed(() => {
  return pluginSettingsRegistry[currentPlugin.value]?.component
})

const selectPlugin = (plugin: PluginUI) => {
  currentPlugin.value = plugin.id
  nextTick(() => pluginSettings.value.load())
}

const load = () => {
  pluginSettings.value.load()
}

const onShow = () => {
  pluginSettings.value.load()
}

const save = () => {
}

defineExpose({ load, onShow })

</script>

