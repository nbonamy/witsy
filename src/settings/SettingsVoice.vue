<template>
  <div class="tab-content">
    <header>
      <div class="title">{{ t('settings.tabs.voice') }}</div>
    </header>
    <main class="form form-vertical form-large">
      <div class="master-detail">
        <div class="md-master">
          <div class="md-master-list">
            <div class="md-master-list-item" v-for="item in available" :key="item.id" :class="{ selected: current == item.id }" @click="select(item)">
              <component :is="item.icon" class="logo" />
              {{ item.label }}
            </div>
          </div>
        </div>
        <component :is="currentView" class="md-detail" ref="settings" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">

import { ref, computed, nextTick } from 'vue'
import { t } from '../services/i18n'
import { MicIcon, Volume2Icon } from 'lucide-vue-next'
import SettingsTTS from './SettingsTTS.vue'
import SettingsSTT from './SettingsSTT.vue'

const current = ref('stt')
const settings = ref(null)

const available = computed(() => {
  return [
    { id: 'stt', label: t('settings.voice.tabs.speechToText'), icon: MicIcon },
    { id: 'tts', label: t('settings.voice.tabs.textToSpeech'), icon: Volume2Icon },
  ]
})

const currentView = computed(() => {
  if (current.value == 'tts') return SettingsTTS
  if (current.value == 'stt') return SettingsSTT
})

const select = (item: { id: string }) => {
  current.value = item.id
  nextTick(() => settings.value.load())
}

const load = (payload: { engine: string }) => {
  if (payload?.engine) {
    select({ id: payload.engine })
  } else {
    settings.value.load()
  }
}

const save = () => {
}

defineExpose({ load })

</script>

