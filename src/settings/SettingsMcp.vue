<template>
  <form class="mcp tab-content vertical large" @keyup.escape.prevent="onEdit(null)">
    <header v-if="selected">
      <BIconChevronLeft class="icon back" @click="onEdit(null)" />
      <div class="title">{{ t('mcp.serverEditor.title') }}</div>
    </header>
    <header v-else>
      <div class="title">{{ t('settings.mcp.modelContextProtocol') }}</div>
    </header>
    <main class="list sliding-root" :class="{ hidden: selected }">
      <McpServerList ref="list" @edit="onEdit" @create="onCreate" />
    </main>
    <main class="editor sliding-pane" :class="{ hidden: !selected }"> 
      <McpServerEditor ref="editor" :type="type" :server="selected" :apiKey="apiKey" @cancel="onEdit(null)" @save="onEdited" @install="onInstall" />
    </main>
  </form>
</template>

<script setup lang="ts">

import { McpInstallStatus, McpServer } from '../types/mcp'
import { ref, nextTick } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import Dialog from '../composables/dialog'
import McpServerList from '../components/McpServerList.vue'
import McpServerEditor, { McpCreateType } from '../components/McpServerEditor.vue'

const list = ref(null)
const editor = ref(null)
const type = ref<McpCreateType>('stdio')
const selected = ref<McpServer | null>(null)
const apiKey = ref('')

const load = async () => {
  selected.value = null
  await list.value.load()
}

const onEdit = (server: McpServer) => {
  type.value = server?.type
  selected.value = server
}

const onCreate = (createType: McpCreateType, url?: string) => {
  type.value = createType
  apiKey.value = createType === 'smithery' ? store.config.mcp.smitheryApiKey : apiKey.value
  selected.value = {
    uuid: null,
    registryId: null,
    state: 'enabled', 
    type: createType === 'smithery' ? 'stdio' : createType,
    command: '',
    url: url || '', 
  }
}

// @ts-expect-error lazy
const onEdited = async ({ type, command, url, cwd, env, headers, title }) => {

  // build a dummy server
  const baseServer: any = {
    uuid: selected.value.uuid,
    registryId: selected.value.registryId,
    state: selected.value.state,
<<<<<<< HEAD
    type, command, url, cwd, env, headers, title
=======
    type, command, url, cwd, env,
>>>>>>> 64aeed22 (feat: make MCP server title field optional)
  }

  if (title !== undefined) {
    baseServer.title = title
  }

  const server: McpServer = baseServer

  selected.value = null

  // edit it
  list.value.setLoading(true)
  nextTick(async () => {
    await window.api.mcp.editServer(server)
    load()
  })

}

// @ts-expect-error lazy
const onInstall = async ({ registry, server, apiKey: regApiKey }) => {

  selected.value = null
  apiKey.value = regApiKey
  list.value.setLoading(true)

  // save
  if (registry === 'smithery') {
    store.config.mcp.smitheryApiKey = apiKey.value
    store.saveSettings()
  }

  await nextTick()
  
  const rc: McpInstallStatus = await window.api.mcp.installServer(registry, server, regApiKey)
  list.value.setLoading(false)

  if (rc === 'success') {
    await load()
    return
  }

  if (rc === 'not_found') {
    Dialog.show({
      title: t('settings.mcp.failedToInstall'),
      text: t('settings.mcp.serverNotFound'),
      confirmButtonText: t('common.retry'),
      showCancelButton: true,
    }).then((result) => {
      if (result.isConfirmed) {
        onCreate('smithery', server)
      }
    })
    return
  }

  if (rc === 'api_key_missing') {
    Dialog.show({
      title: t('settings.mcp.failedToInstall'),
      text: t('settings.mcp.retryWithApiKey'),
      confirmButtonText: t('common.retry'),
      denyButtonText: t('common.copy'),
      showCancelButton: true,
      showDenyButton: true,
    }).then((result) => {
      if (result.isConfirmed) {
        onCreate('smithery', server)
      }
      if (result.isDenied) {
        const command = window.api.mcp.getInstallCommand(registry, server)
        navigator.clipboard.writeText(command)
      }
    })
    return
  }
   
  // general error  
  Dialog.show({
    title: t('settings.mcp.failedToInstall'),
    text: t('settings.mcp.copyInstallCommand'),
    confirmButtonText: t('common.copy'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      const command = window.api.mcp.getInstallCommand(registry, server)
      navigator.clipboard.writeText(command)
    }
  })

}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>

<style scoped>

main {
  width: calc(100% - 4rem);
  &.editor {
    width: 500px;
    align-self: center !important;
  }
}

/* .slide-enter-active,
.slide-leave-active {
  transition: all 0.1s ease;
}

.slide-enter-from {
  transform: translateX(100%);
}

.slide-leave-to {
  transform: translateX(-100%);
} */

</style>
