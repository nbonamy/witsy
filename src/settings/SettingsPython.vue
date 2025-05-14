<template>
  <div>
    <div class="description">
      <b>{{ t('settings.plugins.python.warning') }}</b> {{ t('settings.plugins.python.description1') }}
      {{ t('settings.plugins.python.description2') }}
      <b>{{ t('settings.plugins.python.useAtOwnRisk') }}</b>!
    </div>
    <div class="group horizontal">
      <input type="checkbox" v-model="enabled" @change="save" />
      <label>{{ t('common.enabled') }}</label>
    </div>
    <div class="group">
      <label>{{ t('settings.plugins.python.binaryPath') }}</label>
      <div class="subgroup">
        <input type="text" v-model="binpath" @change="save">
        <div class="actions">
          <button @click.prevent="search" class="search">{{ t('settings.plugins.python.search') }}</button>
          <button @click.prevent="pick">{{ t('common.pick') }}</button>  
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'

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
@import '../../css/form.css';
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