<template>
  <FullScreenDrawer ref="drawer" @closed="emit('closed')">
    <div class="mcp-servers split-pane">
      <div class="sp-main">
        <header>
          <div class="title">{{ t('mcp.modelContextProtocol') }}</div>
          <XIcon class="icon close" v-tooltip="{ text: t('common.close'), position: 'bottom-left' }" @click="onClose" />
        </header>
        <main>
          <template v-if="!selected">
            <List ref="list" :servers="servers" :status="status" :loading="loading" @edit="onEdit" @create="onCreate" @reload="load" @restart="onRestart" />
          </template>
          <template v-else>
            <Editor ref="editor" :type="type" :server="selected" :apiKey="apiKey" @cancel="onEdit(null)" @saved="onEdited" />
          </template>
        </main>
      </div>
    </div>
  </FullScreenDrawer>
</template>

<script setup lang="ts">

import { XIcon } from 'lucide-vue-next'
import { nextTick, onMounted, ref } from 'vue'
import FullScreenDrawer from '../components/FullScreenDrawer.vue'
import Editor, { McpCreateType } from '../mcp/Editor.vue'
import List from '../mcp/List.vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { McpServer } from '../types/mcp'

const drawer = ref<typeof FullScreenDrawer|null>(null)
const list = ref(null)
const editor = ref(null)
const type = ref<McpCreateType>('stdio')
const selected = ref<McpServer | null>(null)
const apiKey = ref('')
const servers = ref([])
const status = ref(null)
const loading = ref(false)

onMounted(() => {
  load()
})

const emit = defineEmits(['closed'])

const onClose = () => {
  drawer.value?.close()
}

const load = async () => {
  selected.value = null
  loading.value = true
  await nextTick()
  const now = new Date().getTime()
  servers.value = window.api.mcp.getServers()
  status.value = window.api.mcp.getStatus()
  setTimeout(() => {
    loading.value = false
  }, 1000 - (new Date().getTime() - now))
}

const onEdit = (server: McpServer) => {
  type.value = server?.type
  selected.value = server
}

const onCreate = (createType: McpCreateType, url?: string) => {
  type.value = createType
  apiKey.value = createType === 'smithery' ? store.config.mcp.smitheryApiKey : apiKey.value
  selected.value = {} as McpServer
}

const onEdited = async () => {
  selected.value = null
  await nextTick()
  load()
}

const onRestart = async () => {
  loading.value = true
  status.value = { servers: [], logs: {} }
  await nextTick()
  await window.api.mcp.reload()
  load()
}

defineExpose({ load })

</script>


<style scoped>

.split-pane {
  .sp-main {
    header {
      padding-bottom: 1.5rem;
      -webkit-app-region: drag;
      .close {
        -webkit-app-region: no-drag;
      }
    }
  }
}

</style>