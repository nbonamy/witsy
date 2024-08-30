
<template>
  <div class="content">
    <div class="tools">
      <div class="plugins">
        <div class="plugin" v-for="plugin in plugins" :key="plugin.id" :class="{ selected: currentPlugin == plugin.id }" @click="selectPlugin(plugin)">
          <img :src="plugin.logo.image" class="logo image" v-if="plugin.logo.image" />
          <component :is="plugin.logo.icon" class="logo icon" v-if="plugin.logo.icon" />
          {{ plugin.label }}
        </div>
      </div>
      <component :is="currentView" class="settings" ref="pluginSettings" />
    </div>
  </div>
</template>

<script setup>

import { ref, computed, nextTick } from 'vue'
import { availablePlugins } from '../plugins/plugins'
import SettingsBrowse from './SettingsBrowse.vue'
import SettingsPython from './SettingsPython.vue'
import SettingsTavily from './SettingsTavily.vue'
import SettingsDallE from './SettingsDall-E.vue'
//import SettingsDropbox from './SettingsDropbox.vue'
import logoPython from '../../assets/python.svg'
import logoTavily from '../../assets/tavily.svg'
import logoOpenAI from '../../assets/openai.svg'
//import logoDropbox from '../../assets/dropbox.svg'

const currentPlugin = ref(Object.keys(availablePlugins)[0])
const pluginSettings = ref(null)

const plugins = computed(() => {
  let res = Object.keys(availablePlugins).map(plugin => {
    return {
      id: plugin,
      label: {
        browse: 'Browse',
        tavily: 'Tavily Search',
        python: 'Python',
        dalle: 'DALL-E',
      }[plugin],
      logo: {
        browse: { image: logoTavily },
        tavily: { image: logoTavily },
        python: { image: logoPython },
        dalle: { image: logoOpenAI },
      }[plugin],
    }
  })
  // res.push({
  //   id: 'dropbox',
  //   label: 'Dropbox',
  //   logo: { image: logoDropbox },
  // })
  return res
})

const currentView = computed(() => {
  if (currentPlugin.value == 'browse') return SettingsBrowse
  if (currentPlugin.value == 'python') return SettingsPython
  if (currentPlugin.value == 'tavily') return SettingsTavily
  if (currentPlugin.value == 'dalle') return SettingsDallE
  //if (currentPlugin.value == 'dropbox') return SettingsDropbox
})

const selectPlugin = (plugin) => {
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

dialog.settings .content {
  width: 100%;
  height: 100%;
  padding: 0px;
}

.tools {
  
  display: flex;
  flex-direction: row;
  align-items: stretch;

  .plugins {
    background-color: white;
    border-right: 1px solid #ccc;
    width: 140px;
    padding: 10px;

    .plugin {

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

      &.selected {
        background-color: var(--highlight-color);
        color: white;
        .logo.image {
          filter: invert(1);
        }
      }
    }
  }

}

.settings {
  flex: 1;
  min-height: 200px;
  padding: 16px 16px 16px 0px !important;
}

</style>