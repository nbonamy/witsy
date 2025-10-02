<template>
  <div class="mcp-server-list">
    <header>
      <div class="title">{{ t('mcp.modelContextProtocol') }}</div>
      <div class="actions">
        <button name="addSmithery" class="large secondary" @click="onCreate('smithery')" v-if="store.isFeatureEnabled('mcp.smithery')">
          <CloudUploadIcon />{{ t('mcp.importSmitheryServer') }}
        </button>
        <button name="addJson" class="large secondary" @click="onImportJson" v-if="store.isFeatureEnabled('mcp.json')">
          <BracesIcon />{{ t('mcp.importJson.menu') }}
        </button>
        <button name="addCustom" class="large primary" @click="onCreate('http')">
          <PlusIcon />{{ t('mcp.addCustomServer') }}
        </button>
      </div>
    </header>

    <main>
      <div v-if="!props.servers?.length" class="empty-state">
        {{ t('mcp.noServersFound') }}
      </div>
      
      <div v-else class="servers-list">

        <div 
          v-for="server in sortedServers" 
          :key="server.uuid" 
          class="server-item"
        >

          <!-- Server Icon -->
          <div class="server-icon">
            <LinkIcon />
          </div>
        
          <!-- Server Content -->
          <div class="server-content clickable" @click="showTools(server)">
            <div class="server-name">{{ getDescription(server) }}</div>
            <div class="server-tools">{{ getToolsCount(server) }}</div>
          </div>
          
          <!-- Server Status -->
          <div
            class="tag"
            :class="{
              'success': getStatusText(server) === 'Running',
              'info': getStatusText(server) === 'Disabled',
              'warning': getStatusText(server) === 'Starting',
              'error': getStatusText(server) === 'Failed'
            }"
          >
            {{ getStatusText(server) }}
          </div>
          
          <!-- Server Actions -->
          <div class="server-actions">
            <!-- Start/Stop button -->
            <ButtonIcon 
              v-if="server.state === 'disabled'"
              name="start"
              class="start" 
              v-tooltip="{ text: t('mcp.tooltips.startServer'), position: 'top-left' }" 
              @click="onEnabled(server)"
            >
              <PlayIcon />
            </ButtonIcon>
            <ButtonIcon 
              v-else
              name="stop"
              class="stop" 
              v-tooltip="{ text: t('mcp.tooltips.stopServer'), position: 'top-left' }" 
              @click="onEnabled(server)"
            >
              <PauseIcon />
            </ButtonIcon>
            
            <!-- View Tools button -->
            <ButtonIcon 
              class="tools"
              :class="{ 'disabled': !isRunning(server) }"
              v-tooltip="{ text: t('mcp.tooltips.viewTools'), position: 'top-left' }"
              @click="showTools(server)"
            >
              <SearchIcon />
            </ButtonIcon>
            
            <!-- Context menu for other actions -->
            <ContextMenuTrigger position="below-right">
              <template #menu="{ close }">
                <div class="item logs" @click="close(); showLogs(server)" v-if="hasLogs(server)">
                  {{ t('mcp.tooltips.viewLogs') }}
                </div>
                <div class="item edit" @click="close(); onEdit(server)">
                  {{ t('mcp.tooltips.editServer') }}
                </div>
                <div class="item restart" @click="close(); onRestartServer(server)">
                  {{ t('mcp.tooltips.restartServer') }}
                </div>
                <div class="item delete danger" @click="close(); onDelete(server)">
                  {{ t('mcp.tooltips.deleteServer') }}
                </div>
              </template>
            </ContextMenuTrigger>
          </div>
        
        </div>

        <div class="actions">
          <Spinner v-if="props.loading" />
          <button class="large secondary" name="reload" @click="onReload" :disabled="props.loading">
            <RefreshCwIcon />{{ t('mcp.refreshServers') }}
          </button>
          <button class="large secondary" name="restart" @click="onRestart" :disabled="props.loading">
            <PowerIcon />{{ t('mcp.restartServers') }}
          </button>
        </div>

      </div>

    </main>
    
    <!-- Tool Selection Dialog -->
    <McpToolSelector
      ref="toolSelector"
      id="mcp-tool-selector"
      :tools="currentServerTools"
      :toolSelection="currentToolSelection"
      @save="onToolSelectionSave"
      @cancel="onToolSelectionCancel"
    />
    
  </div>
</template>

<script setup lang="ts">

import { BracesIcon, CloudUploadIcon } from 'lucide-vue-next'
import { PauseIcon, PlayIcon, PlusIcon, PowerIcon, RefreshCwIcon, SearchIcon } from 'lucide-vue-next'
import Swal from 'sweetalert2/dist/sweetalert2.js'
import { computed, nextTick, PropType, ref } from 'vue'
import ButtonIcon from '../components/ButtonIcon.vue'
import ContextMenuTrigger from '../components/ContextMenuTrigger.vue'
import McpToolSelector from '../components/McpToolSelector.vue'
import Spinner from '../components/Spinner.vue'
import Dialog from '../composables/dialog'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { ToolSelection } from '../types/llm'
import { McpServer, McpServerStatus, McpStatus, McpTool } from '../types/mcp'
import { LinkIcon } from 'lucide-vue-next'

const props = defineProps({
  servers: Array as PropType<McpServer[]>,
  status: Object as PropType<McpStatus>,
  loading: Boolean
})

const selected = ref(null)
const toolSelector = ref<InstanceType<typeof McpToolSelector>>()
const currentServerTools = ref<McpTool[]>([])
const currentToolSelection = ref<ToolSelection>(null)
const currentServer = ref<McpServer|null>(null)

const emit = defineEmits([ 'edit', 'create', 'reload', 'restart', 'restart-server' ])

const sortedServers = computed(() => {
  if (!props.servers) return []
  return [...props.servers].sort((a, b) => {
    const aName = getDescription(a) || ''
    const bName = getDescription(b) || ''
    return aName.localeCompare(bName)
  })
})

const getDescription = (server: McpServer) => {

  // if we have a token description
  if (server.label && server.label.trim().length) {
    let label = server.label.trim()
    if (server.oauth?.tokens?.id_token) {
      label += ` - ${server.oauth.tokens.id_token}`
    }
    return label
  }
  
  
  if (['http', 'sse'].includes(server.type)) return server.url
  if (server.url.includes('@smithery/cli')) {
    const index = server.command === 'cmd' && server.url.startsWith('/c') ? 2 : 0 
    return server.url.replace('-y @smithery/cli@latest run ', '').split(' ')[index]
  }
  if (server.type == 'stdio') return server.command.split(/[\\/]/).pop() + ' ' + server.url
}

const getToolsCount = (server: McpServer) => {
  const status = props.status?.servers.find((s: McpServerStatus) => s.uuid == server.uuid)
  if (!status) return t('mcp.toolsCount', { count: 0 })
  if (Array.isArray(status.toolSelection)) {
    return t('mcp.toolsCount', { count: status.toolSelection.length })
  } else {
    // Handle tools being undefined (starting) or null (error) or array (running)
    const toolsCount = Array.isArray(status.tools) ? status.tools.length : 0
    return t('mcp.toolsCount', { count: toolsCount })
  }
}

const isRunning = (server: McpServer) => {
  if (server.state == 'disabled') return false
  const s = props.status?.servers.find((s: McpServerStatus) => s.uuid == server.uuid)
  return s ? true : false
}

const getStatusText = (server: McpServer) => {
  if (server.state == 'disabled') return 'Disabled'

  // Get server from status to check tools field
  const statusServer = props.status?.servers.find((s: McpServerStatus) => s.uuid == server.uuid)
  if (statusServer) {
    if (statusServer.tools === undefined) return 'Starting'
    if (statusServer.tools === null) return 'Failed'
    if (Array.isArray(statusServer.tools)) return 'Running'
  }

  // Fallback for servers not in status yet
  return 'Starting'
}

const hasLogs = (server: McpServer) => {
  return props.status?.logs?.[server.uuid]
}

const onReload = async () => {
  emit('reload')
}

const showLogs = (server: McpServer) => {
  Dialog.show({
    title: t('mcp.serverLogs'),
    text: props.status.logs[server.uuid].join(''),
    confirmButtonText: t('common.close'),
  })
}

const showTools = async (server: McpServer) => {
  const tools = await window.api.mcp.getServerTools(server.uuid)
  currentServer.value = server
  currentServerTools.value = tools
  currentToolSelection.value = server.toolSelection
  toolSelector.value?.show()
}

const onToolSelectionSave = async (selection: ToolSelection) => {
  if (!currentServer.value) return
  
  // Create a copy of the server with updated toolSelection
  const updatedServer: McpServer = {
    ...JSON.parse(JSON.stringify(currentServer.value)),
    toolSelection: selection
  }
  
  // Save the updated server
  await window.api.mcp.editServer(updatedServer)
  
  // Refresh the server list to show updated data
  emit('reload')
  
  // Clear the current selections
  currentServer.value = null
  currentServerTools.value = []
  currentToolSelection.value = null
}

const onToolSelectionCancel = () => {
  currentServer.value = null
  currentServerTools.value = []
  currentToolSelection.value = null
}

const onRestart = async () => {
  emit('restart')
}

const onCreate = (type: string) => {
  emit('create', type)
}

const onImportJson = async () => {

  const result = await Dialog.show({
    title: t('mcp.importJson.title'),
    text: t('mcp.importJson.details'),
    input: 'textarea',
    inputAttributes: { rows: 10 },
    inputPlaceholder: '"mcp-server-name": {\n  "command": "",\n  "args": [ … ]\n}',
    customClass: { input: 'auto-height' },
    inputValue: '',
    confirmButtonText: t('common.import'),
    showCancelButton: true,
    preConfirm: (json: any) => {
      try {
        return validateServerJson(json)
      } catch (error) {
        Swal.showValidationMessage(error.message);
      }
    }
  })

  if (result.isConfirmed) {

    // build a dummy server
    const server: McpServer = {
      uuid: null,
      registryId: null,
      state: 'enabled',
      type: 'stdio',
      command: result.value.command,
      url: result.value.args.join(' '),
      cwd: result.value.cwd,
      env: result.value.env || {},
      toolSelection: null,
    }

    // edit it
    nextTick(async () => {
      await window.api.mcp.editServer(server)
      emit('reload')
    })

  }

}

const onDelete = async (server: McpServer) => {
  if (!server) return
  Dialog.show({
    target: document.querySelector('.settings .plugins'),
    title: t('mcp.confirmDelete'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then(async (result) => {
    if (result.isConfirmed) {
      nextTick(async () => {
        await window.api.mcp.deleteServer(server.uuid)
        selected.value = null
        emit('reload')
      })
    }
  })
}

const onEnabled = async (server: McpServer) => {
  nextTick(async () => {
    server.state = (server.state == 'enabled' ? 'disabled' : 'enabled')
    await window.api.mcp.editServer(JSON.parse(JSON.stringify(server)))
    emit('reload')
  })
}

const onEdit = (server: McpServer) => {
  emit('edit', server)
}

const onRestartServer = async (server: McpServer) => {
  emit('restart-server', server)
}

const validateServerJson = (json: string) => {

  // build a proper payload
  json = json.trim()
  if (json.endsWith(',')) {
    json = json.slice(0, -1).trim()
  }
  if (!json.length) {
    throw new Error(t('mcp.importJson.errorEmpty'))
  }
  if (!json.startsWith('{')) {
    json = `{${json}}`
  }

  // parse it (might throw a syntax error)
  let dict
  try {
    dict = JSON.parse(json)
  } catch {
    throw new Error(t('mcp.importJson.errorFormat'))
  }
  
  // need an object with exactly one key
  if (typeof dict !== 'object') throw new Error(t('mcp.importJson.errorFormat'))
  if (Object.keys(dict).length != 1) throw new Error(t('mcp.importJson.errorMultiple'))

  // get the server and check command and args
  const server = dict[Object.keys(dict)[0]]
  if (typeof server.command !== 'string' || !server.command?.length) throw new Error(t('mcp.importJson.errorCommand'))
  if (!Array.isArray(server.args)) throw new Error(t('mcp.importJson.errorArgs'))
  
  // done
  return server

}


</script>


<style scoped>

.mcp-server-list {
  
  header {
    .spinner {
      margin-right: 1rem;
    }
  }

  header {
    border-bottom: none;
  }
  
  main {
    flex: 1;
    padding: 2rem;
  }
  
  .empty-state {
    text-align: center;
    color: var(--faded-text-color);
    font-size: 1.1rem;
    padding: 2rem;
  }

  .servers-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .servers-list .actions {
    margin-top: 1rem;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.5rem;
  }
  
  .server-item {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    transition: all 0.2s ease;
  }

  .server-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .server-icon svg {
    width: 24px;
    height: 24px;
    color: var(--text-color);
  }
  
  .server-content {
    flex: 1;
    cursor: pointer;
  }
  
  .server-name {
    font-weight: 500;
    color: var(--text-color);
    margin-bottom: 0.2rem;
  }
  
  .server-tools {
    font-size: 0.85rem;
    color: var(--faded-text-color);
  }

  .tag {
    font-size: 12px;
  }
  
  .server-actions {
    display: flex;
    gap: 0.25rem;
    align-items: center;
    flex-shrink: 0;
  }
  
  .server-actions .disabled {
    opacity: 0.4;
    pointer-events: none;
  }
}

</style>
