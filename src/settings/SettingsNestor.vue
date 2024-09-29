
<template>
  <div>
    <div class="description">
      This plugin allows LLM engines to access local API on the network.
      Check <a href="https://github.com/nbonamy/nestor" target="_blank">https://github.com/nbonamy/nestor</a>.
    </div>
    <div class="group">
      <label>Enabled</label>
      <input type="checkbox" v-model="enabled" @change="save" />
    </div>
  </div>
</template>

<script setup>

import { ref } from 'vue'
import { store } from '../services/store'

const enabled = ref(false)

const load = () => {
  enabled.value = store.config.plugins.nestor.enabled || false
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

