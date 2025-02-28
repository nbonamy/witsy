<template>
  <div>
    <div class="description">
      {{ t('settings.plugins.nestor.description') }}
      <a href="https://github.com/nbonamy/nestor" target="_blank">{{ t('settings.plugins.nestor.githubLink') }}</a>.
    </div>
    <div class="description status" v-if="status">
      <span v-if="status.hubs?.length == 0">{{ t('settings.plugins.nestor.noHubs') }}</span>
      <span v-else><b>
        <span>{{ t('settings.plugins.nestor.connectedToHubs', { count: status.hubs.length }) }}</span>
        <span v-if="tools.length > 0"><br/>{{ t('settings.plugins.nestor.totalServices', { count: tools.length }) }}</span>
        <span v-else><br/>{{ t('settings.plugins.nestor.noServices') }}</span>
      </b></span>
    </div>
    <div class="group">
      <label>{{ t('common.enabled') }}</label>
      <input type="checkbox" v-model="enabled" @change="save" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import { ref, computed } from 'vue'
import { store } from '../services/store'

const enabled = ref(false)
const status = ref(null)

const tools = computed(() => {
  if (!status.value) return []
  return status.value.hubs.reduce((acc: [], hub: any) => {
    return acc.concat(hub.tools.map((tool: any) => tool.name))
  }, [])
})

const load = async () => {
  enabled.value = store.config.plugins.nestor.enabled || false
  status.value = await window.api.nestor.getStatus()
}

const save = () => {
  store.config.plugins.nestor.enabled = enabled.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
@import '../../css/panel.css';
</style>

<style>
.status {
  font-weight: bold;
}
</style>