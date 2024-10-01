
<template>
  <div>
    <div class="description">
      This plugin allows LLM engines to access local API on the network.
      Check <a href="https://github.com/nbonamy/nestor" target="_blank">https://github.com/nbonamy/nestor</a>.
    </div>
    <div class="description status" v-if="status">
      <span v-if="status.hubs?.length == 0">No Nestor hubs available</span>
      <span v-else><b>
        <span>Connected to {{ status.hubs.length }} Nestor hub{{ status.hubs.length > 1 ? 's' : '' }}</span>
        <span v-if="tools.length > 0"><br/>Total of {{ tools.length }} service{{ tools.length > 1 ? 's' : '' }} available</span>
        <span v-else><br/>No service available</span>
      </b></span>
    </div>
    <div class="group">
      <label>Enabled</label>
      <input type="checkbox" v-model="enabled" @change="save" />
    </div>
  </div>
</template>

<script setup>

import { ref, computed } from 'vue'
import { store } from '../services/store'

const enabled = ref(false)
const status = ref(null)

const tools = computed(() => {
  if (!status.value) return []
  return status.value.hubs.reduce((acc, hub) => {
    return acc.concat(hub.tools.map(tool => tool.name))
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