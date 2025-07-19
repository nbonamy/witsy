<template>
  <div class="form tab-content form-vertical form-large">
    <header>
      <div class="title">{{ t('settings.tabs.plugins') }}</div>
    </header>
    <main>
      <div class="master-detail">
        <div class="md-master">
          <div class="md-master-list">
            <div class="md-master-list-item" v-for="plugin in plugins" :key="plugin.id" :class="{ selected: currentPlugin == plugin.id }" :data-id="plugin.id" @click="selectPlugin(plugin)">
              <img :src="plugin.logo.image" class="logo image" v-if="plugin.logo.image" />
              <component :is="plugin.logo.icon" class="logo icon" v-if="plugin.logo.icon" />
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

import { ref, computed, nextTick } from 'vue'
import { availablePlugins } from '../plugins/plugins'
import { t } from '../services/i18n'
import SettingsBrowse from './SettingsBrowse.vue'
import SettingsPython from './SettingsPython.vue'
import SettingsSearch from './SettingsSearch.vue'
import SettingsImage from './SettingsImage.vue'
import SettingsVideo from './SettingsVideo.vue'
import SettingsYouTube from './SettingsYouTube.vue'
import SettingsMemory from './SettingsMemory.vue'
import SettingsVega from './SettingsVega.vue'
import SettingsFilesystem from './SettingsFilesystem.vue'
import { BIconBinocularsFill, BIconCameraReelsFill, BIconCloudArrowDownFill, BIconPaletteFill, BIconYoutube, BIconPersonVcardFill, BIconFolderFill } from 'bootstrap-icons-vue'
import WIconPython from '../../assets/python.svg?component'
import WIconVega from '../../assets/vega.svg?component'

const currentPlugin = ref(Object.keys(availablePlugins)[0])
const pluginSettings = ref(null)

type PluginUI = {
  id: string,
  label: string,
  logo: { image?: string, icon?: any },
}

const plugins = computed((): PluginUI[] => {

  let res = Object.keys(availablePlugins).filter(plugin => plugin != 'mcp').map(plugin => {
    return {
      id: plugin,
      label: t(`settings.plugins.${plugin}.title`),
      logo: {
        browse: { icon: BIconCloudArrowDownFill },
        search: { icon: BIconBinocularsFill },
        python: { icon: WIconPython },
        image: { icon: BIconPaletteFill },
        video: { icon: BIconCameraReelsFill },
        memory: { icon: BIconPersonVcardFill },
        youtube: { icon: BIconYoutube },
        vega: { icon: WIconVega },
        filesystem: { icon: BIconFolderFill },
        // mcp: { icon: WIconMcp },
      }[plugin],
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

