
<template>
  <div class="content">
    <div class="list-panel">
      <div class="list">
        <div class="item" v-for="plugin in plugins" :key="plugin.id" :class="{ selected: currentPlugin == plugin.id }" @click="selectPlugin(plugin)">
          <img :src="plugin.logo.image" class="logo image" v-if="plugin.logo.image" />
          <component :is="plugin.logo.icon" class="logo icon" v-if="plugin.logo.icon" />
          {{ plugin.label }}
        </div>
      </div>
      <component :is="currentView" class="panel" ref="pluginSettings" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, computed, nextTick } from 'vue'
import { availablePlugins } from '../plugins/plugins'
import SettingsBrowse from './SettingsBrowse.vue'
import SettingsPython from './SettingsPython.vue'
import SettingsTavily from './SettingsTavily.vue'
import SettingsImage from './SettingsImage.vue'
import SettingsVideo from './SettingsVideo.vue'
import SettingsYouTube from './SettingsYouTube.vue'
import SettingsVega from './SettingsVega.vue'
import SettingsNestor from './SettingsNestor.vue'
import { BIconCameraReels, BIconPalette, BIconYoutube } from 'bootstrap-icons-vue'

// @ts-expect-error svg
import logoDownload from '../../assets/download.svg'
// @ts-expect-error svg
import logoPython from '../../assets/python.svg'
// @ts-expect-error svg
import logoTavily from '../../assets/tavily.svg'
// @ts-expect-error svg
import logoVega from '../../assets/vega.svg'
// @ts-expect-error svg
import logoNestor from '../../assets/nestor.jpg'

const currentPlugin = ref(Object.keys(availablePlugins)[0])
const pluginSettings = ref(null)

type PluginUI = {
  id: string,
  label: string,
  logo: { image?: string, icon?: any },
}

const plugins = computed((): PluginUI[] => {

  // nestor is not available everywhere
  const plugins = availablePlugins
  if (!window.api.nestor.isAvailable()) {
    delete plugins['nestor']
  }

  /// now we can return the plugins
  let res = Object.keys(plugins).map(plugin => {
    return {
      id: plugin,
      label: {
        browse: 'Download',
        tavily: 'Tavily Search',
        python: 'Python',
        image: 'Text-to-Image',
        video: 'Text-to-Video',
        youtube: 'YouTube',
        vega: 'Vega',
        nestor: 'Nestor',
      }[plugin],
      logo: {
        browse: { image: logoDownload },
        tavily: { image: logoTavily },
        python: { image: logoPython },
        image: { icon: BIconPalette },
        video: { icon: BIconCameraReels },
        youtube: { icon: BIconYoutube },
        vega: { image: logoVega },
        nestor: { image: logoNestor },
      }[plugin],
    }
  })
  return res
})

const currentView = computed(() => {
  if (currentPlugin.value == 'browse') return SettingsBrowse
  if (currentPlugin.value == 'python') return SettingsPython
  if (currentPlugin.value == 'tavily') return SettingsTavily
  if (currentPlugin.value == 'image') return SettingsImage
  if (currentPlugin.value == 'video') return SettingsVideo
  if (currentPlugin.value == 'youtube') return SettingsYouTube
  if (currentPlugin.value == 'vega') return SettingsVega
  if (currentPlugin.value == 'nestor') return SettingsNestor
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

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>

<style scoped>

</style>