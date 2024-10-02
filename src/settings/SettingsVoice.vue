
<template>
  <div class="content">
    <div class="tools">
      <div class="select">
        <div class="item" v-for="item in available" :key="item.id" :class="{ selected: current == item.id }" @click="select(item)">
          {{ item.label }}
        </div>
      </div>
      <component :is="currentView" class="settings" ref="settings" />
    </div>
  </div>
</template>

<script setup>

import { ref, computed, nextTick } from 'vue'
import SettingsTTS from './SettingsTTS.vue'
import SettingsSTT from './SettingsSTT.vue'

const current = ref('tts')
const settings = ref(null)

const available = computed(() => {
  return [
    { id: 'tts', label: 'Text to Speech', icon: 'mdi-speaker' },
    { id: 'stt', label: 'Speech to Text', icon: 'mdi-microphone' },
  ]
})

const currentView = computed(() => {
  if (current.value == 'tts') return SettingsTTS
  if (current.value == 'stt') return SettingsSTT
})

const select = (item) => {
  current.value = item.id
  nextTick(() => settings.value.load())
}

const load = () => {
  settings.value.load()
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

  .select {
    background-color: white;
    border-right: 1px solid #ccc;
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