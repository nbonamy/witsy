
<template>
  <div>
    <div class="group">
      <label>Enabled</label>
      <input type="checkbox" v-model="enabled" :disabled="!binpath" @change="save" />
    </div>
    <div class="group">
      <label>Python Binary</label>
      <div class="subgroup">
        <input type="text" v-model="binpath" @change="save">
        <div class="actions">
          <button @click.prevent="search">Search</button>
          <button @click.prevent="pick">Pick</button>  
        </div>
      </div>
    </div>
    <div class="group">
      <label></label>
      <span>
        Warning! Enabling this plugin will allow LLM engines to run arbitray code on your computer.
        There is no way to predict if the code that LLM engines will generate is safe or not.<br/>
        Use at your own risk!
      </span>
    </div>
  </div>
</template>

<script setup>

import { ref } from 'vue'
import { store } from '../services/store'
import { ipcRenderer } from 'electron'

const enabled = ref(false)
const binpath = ref(null)

const load = () => {
  enabled.value = store.config.plugins.python.enabled || false
  binpath.value = store.config.plugins.python.binpath || ''
}

const search = () => {
  const path = ipcRenderer.sendSync('find-program', 'python3')
  if (path) {
    binpath.value = path
    save()
  }
}

const pick = () => {
  const path = ipcRenderer.sendSync('pick-file', { location: true })
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


</style>