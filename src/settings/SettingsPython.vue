
<template>
  <div>
    <div class="description">
      <b>Warning!</b> Enabling this plugin will allow LLM engines to run arbitray code on your computer.
      There is no way to predict if the code that LLM engines will generate is safe or not.
      <b>Use at your own risk</b>!
    </div>
    <div class="group">
      <label>Enabled</label>
      <input type="checkbox" v-model="enabled" @change="save" />
    </div>
    <div class="group">
      <label>Python Binary</label>
      <div class="subgroup">
        <input type="text" v-model="binpath" @change="save">
        <div class="actions">
          <button @click.prevent="pick">Pick</button>  
          <button @click.prevent="search" class="search">Search</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'

const enabled = ref(false)
const binpath = ref(null)

const load = () => {
  enabled.value = store.config.plugins.python.enabled || false
  binpath.value = store.config.plugins.python.binpath || ''
}

const search = () => {
  const path = window.api.file.find('python3')
  if (path) {
    binpath.value = path
    save()
  }
}

const pick = () => {
  const path = window.api.file.pick({ location: true })
  if (path) {
    binpath.value = path
    save()
  }
}

const save = () => {
  store.config.plugins.python.enabled = enabled.value
  store.config.plugins.python.binpath = binpath.value
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

<style scoped>

.actions {
  margin-top: 4px !important;
}

.actions :first-child {
  margin-left: 0px;
}

.windows .actions .search {
  display: none;
}

</style>