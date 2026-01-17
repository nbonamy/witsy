<template>
  <div class="tab-content">
    <header>
      <div class="title">{{ t('settings.tabs.voice') }}</div>
    </header>
    <main class="form form-vertical form-large">
      <div class="master-detail">
        <div class="md-master">
          <div class="md-master-list">
            <template v-for="item in available" :key="item.id">
              <div v-if="item.type === 'header'" class="md-master-list-header">
                {{ item.label }}
              </div>
              <div v-else class="md-master-list-item" :class="{ selected: current == item.id, [item.class]: item.class }" @click="select(item)">
                <component :is="item.icon" class="logo" />
                {{ item.label }}
              </div>
            </template>
          </div>
        </div>
        <component :is="currentView" class="md-detail" ref="settings" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">

import { t } from '@services/i18n'
import { BoxIcon, KeyboardIcon, SettingsIcon } from 'lucide-vue-next'
import { computed, nextTick, ref } from 'vue'
import SettingsQuickDictation from './SettingsQuickDictation.vue'
import SettingsSTTConfiguration from './SettingsSTTConfiguration.vue'
import SettingsSTTModel from './SettingsSTTModel.vue'
import SettingsTTS from './SettingsTTS.vue'

const current = ref('sttModel')
const settings = ref(null)

const available = computed(() => {
  return [
    { id: 'sttHeader', type: 'header', label: t('settings.voice.tabs.speechToText') },
    { id: 'sttModel', type: 'item', label: t('settings.voice.tabs.model'), icon: BoxIcon },
    { id: 'sttConfiguration', type: 'item', label: t('settings.voice.tabs.configuration'), icon: SettingsIcon },
    { id: 'quickDictation', type: 'item', label: t('settings.voice.tabs.quickDictation'), icon: KeyboardIcon, class: 'quick-dictation' },
    { id: 'ttsHeader', type: 'header', label: t('settings.voice.tabs.textToSpeech') },
    { id: 'ttsModel', type: 'item', label: t('settings.voice.tabs.model'), icon: BoxIcon },
  ]
})

const currentView = computed(() => {
  if (current.value == 'quickDictation') return SettingsQuickDictation
  if (current.value == 'ttsModel') return SettingsTTS
  if (current.value == 'sttModel') return SettingsSTTModel
  if (current.value == 'sttConfiguration') return SettingsSTTConfiguration
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

<style scoped>
.md-master-list-header {
  padding: 12px 16px 8px 4px;
  font-size: 0.85em;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--control-placeholder-text-color);
  letter-spacing: 0.5px;
  margin-top: 12px;
}

.md-master-list-header:first-child {
  margin-top: 0;
}
</style>

