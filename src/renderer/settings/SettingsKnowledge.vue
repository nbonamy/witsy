<template>
  <div class="form form-vertical form-large">
    <div class="description">
      {{ t('settings.plugins.knowledge.description') }}
    </div>
    <div class="form-field horizontal">
      <input type="checkbox" id="knowledge-enabled" name="enabled" v-model="enabled" @change="save" />
      <label for="knowledge-enabled">{{ t('common.enabled') }}</label>
    </div>
    <div class="warning" v-if="enabled && !hasValidDocRepos">
      <p>{{ t('settings.plugins.knowledge.noValidDocRepos') }}</p>
      <p><a href="#" @click.prevent="openDocRepos">{{ t('prompt.menu.docRepos.manage') }}</a></p>
    </div>
  </div>
</template>

<script setup lang="ts">

import { DocumentBase } from 'types/rag'
import { ref } from 'vue'
import useEventBus from '@composables/event_bus'
import { store } from '@services/store'
import { t } from '@services/i18n'

const enabled = ref(false)
const hasValidDocRepos = ref(false)

const load = () => {
  enabled.value = store.config.plugins.knowledge.enabled || false
  checkValidDocRepos()
}

const checkValidDocRepos = () => {
  const docRepos = window.api.docrepo.list(store.config.workspaceId) as DocumentBase[]
  hasValidDocRepos.value = docRepos?.some(repo =>
    repo.workspaceId === store.config.workspaceId &&
    repo.description &&
    repo.description.trim().length > 0
  ) || false
}

const save = () => {
  store.config.plugins.knowledge.enabled = enabled.value
  store.saveSettings()
}

const openDocRepos = () => {
  useEventBus().emitBusEvent('set-main-window-mode', 'docrepos')
}

defineExpose({ load })

</script>
