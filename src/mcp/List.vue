<template>
  <div class="mcp-server-list">
    
    <header>
      <div class="title">&nbsp;</div>
      <div class="actions">
        <button name="addSmithery" class="large secondary" @click="onCreate('smithery')" v-if="store.isFeatureEnabled('mcp.smithery')">
          <BIconCloudPlus />{{ t('mcp.importSmitheryServer') }}
        </button>
        <button name="addJson" class="large secondary" @click="onImportJson" v-if="store.isFeatureEnabled('mcp.json')">
          <BIconBraces />{{ t('mcp.importJson.menu') }}
        </button>
        <button name="addCustom" class="large primary" @click="onCreate('http')">
          <PlusIcon />{{ t('mcp.addCustomServer') }}
        </button>
      </div>
    </header>

    <section class="integrations" v-if="store.isFeatureEnabled('mcp.station1')">
      <div class="integrations-list">
        <div 
          v-for="integration in integrations" 
          :key="integration.id"
          :class="['integration', `${integration.id}-card`, { 'loading': mcpLoading === integration.id }]" 
          @click="onConnect(integration.id)"
        >
          <div class="integration-icon">
            <img :src="integration.icon" :alt="integration.name" />
          </div>
          <div class="integration-content">
            <h3>{{ integration.name }}</h3>
            <p>{{ integration.description }}</p>
          </div>
          <div class="integration-action" v-if="mcpLoading !== integration.id">
            <PlusIcon />
          </div>
          <div class="integration-spinner" v-if="mcpLoading === integration.id">
            <Spinner />
          </div>
        </div>
      </div>
      
      <div v-if="integrationsLoading" class="integrations-loading">
        <Spinner /> Loading integrations...
      </div>
    </section>

    <main>
      <div v-if="!props.servers?.length" class="empty-state">
        {{ t('mcp.noServersFound') }}
      </div>
      
      <table v-else class="table-plain table-plain-spaced">
        <thead>
          <tr>
            <th class="status-col">&nbsp;</th>
            <th class="server-col">{{ t('mcp.server') }}</th>
            <th class="type-col">{{ t('common.type') }}</th>
            <th class="actions-col">{{ t('common.actions') }}</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="server in props.servers" :key="server.uuid" class="panel-item">
            <td class="status-col">
              <span class="status-indicator">{{ getStatus(server) }}</span>
            </td>
            <td class="server-col server-info clickable" @click="showTools(server)">
              <div class="text">{{ getDescription(server) }}</div>
              <div class="subtext">{{ getToolsCount(server) }}</div>
            </td>
            <td class="type-col">{{ getType(server) }}</td>
            <td class="actions-col">
              <div class="actions">
                <!-- Start/Stop button -->
                <PlayIcon 
                  v-if="server.state === 'disabled'"
                  class="start" 
                  v-tooltip="{ text: t('mcp.tooltips.startServer'), position: 'top-left' }" 
                  @click.stop="onEnabled(server)" 
                />
                <PauseIcon 
                  v-else
                  class="stop" 
                  v-tooltip="{ text: t('mcp.tooltips.stopServer'), position: 'top-left' }" 
                  @click.stop="onEnabled(server)" 
                />
                
                <!-- View Tools button -->
                <SearchIcon 
                  class="tools"
                  :class="{ 'disabled': !isRunning(server) }"
                  v-tooltip="{ text: t('mcp.tooltips.viewTools'), position: 'top-left' }"
                  @click.stop="showTools(server)" 
                />
                
                <!-- Context menu for other actions -->
                <ContextMenuTrigger position="below-left">
                  <template #menu="{ close }">
                    <div class="item logs" @click="close(); showLogs(server)" v-if="hasLogs(server)">
                      {{ t('mcp.tooltips.viewLogs') }}
                    </div>
                    <div class="item edit" @click="close(); onEdit(server)">
                      {{ t('mcp.tooltips.editServer') }}
                    </div>
                    <div class="item delete danger" @click="close(); onDelete(server)">
                      {{ t('mcp.tooltips.deleteServer') }}
                    </div>
                  </template>
                </ContextMenuTrigger>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="table-actions" v-if="props.servers?.length">
        <button class="secondary" name="reload" @click="onReload" :disabled="props.loading">
          <RefreshCwIcon />{{ t('mcp.refreshServers') }}
        </button>
        <button class="secondary" name="restart" @click="onRestart" :disabled="props.loading">
          <PowerIcon />{{ t('mcp.restartServers') }}
        </button>
        <Spinner v-if="props.loading" />
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

import { BIconBraces, BIconCloudPlus } from 'bootstrap-icons-vue'
import { PauseIcon, PlayIcon, PlusIcon, PowerIcon, RefreshCwIcon, SearchIcon, SquareIcon } from 'lucide-vue-next'
import Swal from 'sweetalert2/dist/sweetalert2.js'
import { nextTick, onMounted, PropType, ref } from 'vue'
import ContextMenuTrigger from '../components/ContextMenuTrigger.vue'
import McpToolSelector from '../components/McpToolSelector.vue'
import Spinner from '../components/Spinner.vue'
import Dialog from '../composables/dialog'
import { OAuthStatus, useMcpServer } from '../composables/mcp'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { McpServer, McpServerStatus, McpStatus, McpTool } from '../types/mcp'
import { ToolSelection } from '../types/llm'

interface Integration {
  id: string
  name: string
  description: string
  icon: string
  category: string
  auth?: string
  hasCredentials: boolean
  mcpUrl: string
}

const props = defineProps({
  servers: Array as PropType<McpServer[]>,
  status: Object as PropType<McpStatus>,
  loading: Boolean
})

const selected = ref(null)
const mcpLoading = ref<string|undefined>(undefined)
const integrations = ref<Integration[]>([])
const integrationsLoading = ref(false)
const toolSelector = ref<InstanceType<typeof McpToolSelector>>()
const currentServerTools = ref<McpTool[]>([])
const currentToolSelection = ref<ToolSelection>(null)
const currentServer = ref<McpServer|null>(null)

const emit = defineEmits([ 'edit', 'create', 'reload', 'restart' ])

const fetchIntegrations = async (): Promise<void> => {
  try {
    integrationsLoading.value = true
    const response = await fetch('http://localhost:3001/api/v1/integrations')
    if (response.ok) {
      integrations.value = await response.json()
    }
  } catch (error) {
    console.error('Failed to fetch integrations:', error)
  } finally {
    integrationsLoading.value = false
  }
}

onMounted(() => {
  if (store.isFeatureEnabled('mcp.station1')) {
    fetchIntegrations()
  }
})

const getType = (server: McpServer) => {
  if (server.url.includes('@smithery/cli')) return 'smithery'
  else return server.type
}

const getDescription = (server: McpServer) => {
  if (server.label && server.label.trim().length) return server.label
  if (['http', 'sse'].includes(server.type)) return server.url
  if (server.url.includes('@smithery/cli')) {
    const index = server.command === 'cmd' && server.url.startsWith('/c') ? 2 : 0 
    return server.url.replace('-y @smithery/cli@latest run ', '').split(' ')[index]
  }
  if (server.type == 'stdio') return server.command.split(/[\\/]/).pop() + ' ' + server.url
}

const getToolsCount = (server: McpServer) => {
  const count = props.status?.servers.find((s: McpServerStatus) => s.uuid == server.uuid)?.tools?.length || 0
  return count === 1 ? '1 tool available' : `${count} tools available`
}

const isRunning = (server: McpServer) => {
  if (server.state == 'disabled') return false
  const s = props.status?.servers.find((s: McpServerStatus) => s.uuid == server.uuid)
  return s ? true : false
}

const getStatus = (server: McpServer) => {
  if (server.state == 'disabled') return '🔶'
  return isRunning(server) ? '✅' : '❌'
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

const getAppConnectUrl = (integrationId: string): string => {
  const integration = integrations.value.find(int => int.id === integrationId)
  return integration ? integration.mcpUrl : `http://localhost:3001/mcp/${integrationId}`
}

const onConnect = async (app: string): Promise<void> => {

  const oauthStatus: OAuthStatus = {}
  const url = getAppConnectUrl(app)
  if (await useMcpServer().initOauth(true, url, {}, oauthStatus)) {
    await setupOAuth(app, url, oauthStatus)
  }
}

const setupOAuth = async (integrationId: string, url: string, oauthStatus: OAuthStatus) => {
  const oauthConfig = await useMcpServer().setupOAuth(url, oauthStatus)
  if (oauthConfig) {
    const integration = integrations.value.find(int => int.id === integrationId)
    const integrationName = integration ? integration.name : integrationId

    // build a dummy server
    const server: McpServer = {
      uuid: null,
      registryId: null,
      state: 'enabled',
      type: 'http',
      label: integrationName,
      url: url,
      oauth: JSON.parse(JSON.stringify(oauthConfig)),
      toolSelection: null,
    }

    // save it
    mcpLoading.value = integrationId
    await window.api.mcp.editServer(server)
    emit('reload')
    mcpLoading.value = undefined

  }
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
  
  .integrations {
    padding-top: 4rem;
    max-width: 1000px;
    margin: 0 auto;
  }
  
  .integrations-list {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .integration {
    flex: 0 0 260px;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--panel-background);
    border-radius: 12px;
    border: 1px solid var(--border-color);
    transition: all 0.2s ease;
    cursor: pointer;
    position: relative;
  }
  
  .integration:hover {
    background: var(--hover-background);
    border-color: var(--accent-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .integration.loading {
    cursor: wait;
    opacity: 0.7;
  }
  
  .integration-icon {
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    img {
      width: 100%;
      height: 100%;
    }
  }
  
  .integration-content {
    flex: 1;
  }
  
  .integration-content h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-color);
  }
  
  .integration-content p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--faded-text-color);
    line-height: 1.4;
  }
  
  .integration-action {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    color: var(--accent-color);
    opacity: 0.6;
    transition: opacity 0.2s ease;
  }
  
  .integration:hover .integration-action {
    opacity: 1;
  }
  
  .integration-spinner {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
  }

  .integrations-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem;
    color: var(--faded-text-color);
  }

  header {
    border-bottom: none;
  }
  
  main {
    padding: 4rem;
    max-width: 1000px;
    margin: 0 auto;
  }
  
  .empty-state {
    text-align: center;
    color: var(--faded-text-color);
    font-size: 1.1rem;
    padding: 4rem;
  }
  
  .server-info.clickable {
    cursor: pointer;
  }
  
  .server-info {
    .subtext {
      font-size: 0.85rem;
      color: var(--faded-text-color);
      margin-top: 0.2rem;
    }
  }
  
  .status-indicator {
    font-size: 1.2rem;
  }
  
  .actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  
  .actions svg {
    cursor: pointer;
    width: var(--icon-lg);
    height: var(--icon-lg);
  }
  
  .actions svg.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  
  .table-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-top: 2rem;
    padding: 0 1rem;
  }
  
  .table-actions button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  
  /* Column width optimization */
  table {
    table-layout: fixed;
  }
  
  .status-col {
    width: 3rem;
    text-align: center;
  }
  
  .server-col {
    width: auto;
  }
  
  .type-col {
    width: 6rem;
  }
  
  .actions-col {
    width: 6rem;
  }
}

</style>
