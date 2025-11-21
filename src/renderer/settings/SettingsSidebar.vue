<template>
  <div class="sidebar tab-content" @keyup.escape.prevent="onEdit(null)">
    <header v-if="edited">
      <div class="title">{{ edited.name || t('webapps.edit') }}</div>
    </header>
    <header v-else>
      <div class="title">{{ t('settings.tabs.sidebar') }}</div>
    </header>
    <main class="sliding-root" :class="{ visible: !edited }">
      <div class="title">{{ t('sidebar.features.title') }}</div>
      <SidebarFeatures @save="saveWorkspace" />
      <div class="title">{{ t('webapps.title') }}</div>
      <WebAppsList ref="list" @edit="onEdit" @create="onCreate" />
    </main>
    <main class="editor sliding-pane" :class="{ visible: edited }">
      <WebAppEditor ref="editor" :webapp="edited" @webapp-modified="onWebappModified" />
    </main>
  </div>
</template>

<script setup lang="ts">

import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'
import SidebarFeatures from '../components/SidebarFeatures.vue'
import WebAppEditor from '../components/WebAppEditor.vue'
import WebAppsList from '../components/WebAppsList.vue'
import { t } from '@services/i18n'
import { store } from '@services/store'
import { WebApp } from 'types/workspace'

const list = ref(null)
const editor = ref(null)
const selected = ref<WebApp | null>(null)
const edited = ref<WebApp | null>(null)

const onCreate = (current: WebApp) => {
  selected.value = current
  edited.value = {
    id: null,
    name: '',
    url: 'https://',
    enabled: true
  } as any
}

const onEdit = (webapp: WebApp | null) => {
  selected.value = null
  edited.value = webapp
}

const onWebappModified = (payload: WebApp | null) => {
  // Cancel
  if (!payload) {
    edited.value = null
    return
  }

  // New webapp
  let webapp = null
  if (payload.id == null) {
    webapp = {
      id: uuidv4(),
      name: payload.name,
      url: payload.url,
      icon: payload.icon,
      preserveColors: payload.preserveColors,
      enabled: payload.enabled
    }

    // Find the index of the currently selected
    const selectedIndex = store.workspace.webapps?.findIndex(w => w.id === selected.value?.id) ?? -1
    if (selectedIndex !== -1) {
      store.workspace.webapps.splice(selectedIndex, 0, webapp)
    } else {
      if (!store.workspace.webapps) {
        store.workspace.webapps = []
      }
      store.workspace.webapps.push(webapp)
    }
  } else {
    webapp = store.workspace.webapps?.find(w => w.id === payload.id)
    if (webapp) {
      webapp.name = payload.name
      webapp.url = payload.url
      webapp.icon = payload.icon
      webapp.preserveColors = payload.preserveColors
      webapp.enabled = payload.enabled
    }
  }

  // Done
  edited.value = null
  saveWorkspace()
  load()
}

const saveWorkspace = () => {
  window.api.workspace.save(JSON.parse(JSON.stringify(store.workspace)))
}

const load = () => {
  list.value?.load()
}

defineExpose({ load })

</script>

<style scoped>

.title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 1rem;
}

</style>
