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

    <section class="hero">
      <div class="hero-cards">
        <div class="hero-card kochava-card" @click="onConnect('kochava')" :class="{ 'loading': mcpLoading }">
          <div class="card-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#4F46E5"/>
              <path d="M8 8h16v4H8V8zm0 6h16v4H8v-4zm0 6h16v4H8v-4z" fill="white"/>
            </svg>
          </div>
          <div class="card-content">
            <h3>{{ t('mcp.hero.kochava.title') }}</h3>
            <p>{{ t('mcp.hero.kochava.description') }}</p>
          </div>
          <div class="card-action" v-if="!mcpLoading">
            <PlusIcon />
          </div>
          <div class="card-spinner" v-if="mcpLoading">
            <Spinner />
          </div>
        </div>

        <div class="hero-card github-card" @click="onConnect('github')" :class="{ 'loading': mcpLoading }">
          <div class="card-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M16 2C8.268 2 2 8.268 2 16c0 6.18 4.008 11.422 9.572 13.282.7.128.958-.304.958-.674 0-.332-.012-1.21-.018-2.376-3.896.846-4.716-1.878-4.716-1.878-.636-1.616-1.554-2.046-1.554-2.046-1.27-.868.096-.85.096-.85 1.406.098 2.146 1.444 2.146 1.444 1.25 2.14 3.278 1.522 4.078 1.164.126-.906.488-1.522.888-1.872-3.11-.354-6.378-1.554-6.378-6.92 0-1.528.546-2.778 1.444-3.756-.144-.354-.626-1.782.138-3.712 0 0 1.178-.376 3.86 1.438 1.12-.312 2.32-.468 3.512-.474 1.192.006 2.392.162 3.512.474 2.682-1.814 3.86-1.438 3.86-1.438.764 1.93.282 3.358.138 3.712.898.978 1.444 2.228 1.444 3.756 0 5.378-3.274 6.56-6.392 6.908.502.432.952 1.284.952 2.588 0 1.87-.018 3.378-.018 3.836 0 .374.254.808.966.672C25.996 27.418 30 22.178 30 16c0-7.732-6.268-14-14-14z" fill="#24292e"/>
            </svg>
          </div>
          <div class="card-content">
            <h3>{{ t('mcp.hero.github.title') }}</h3>
            <p>{{ t('mcp.hero.github.description') }}</p>
          </div>
          <div class="card-action" v-if="!mcpLoading">
            <PlusIcon />
          </div>
          <div class="card-spinner" v-if="mcpLoading">
            <Spinner />
          </div>
        </div>
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
            <td class="server-col server-info clickable info" @click="onEdit(server)">
              <div class="text">{{ getDescription(server) }}</div>
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
    
  </div>
</template>

<script setup lang="ts">

import { BIconBraces, BIconCloudPlus } from 'bootstrap-icons-vue'
import { PauseIcon, PlayIcon, PlusIcon, PowerIcon, RefreshCwIcon, SearchIcon, SquareIcon } from 'lucide-vue-next'
import Swal from 'sweetalert2/dist/sweetalert2.js'
import { nextTick, PropType, ref } from 'vue'
import ContextMenuTrigger from '../components/ContextMenuTrigger.vue'
import Spinner from '../components/Spinner.vue'
import Dialog from '../composables/dialog'
import { OAuthStatus, useMcpServer } from '../composables/mcp'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { McpServer, McpServerStatus } from '../types/mcp'

const props = defineProps({
  servers: Array as PropType<McpServer[]>,
  status: Object,
  loading: Boolean
})

const selected = ref(null)
const mcpLoading = ref<string|undefined>(undefined)

const emit = defineEmits([ 'edit', 'create', 'reload', 'restart' ])

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
  const tools = await window.api.mcp.getServerTools(server.registryId)
  if (tools.length) {
    Dialog.show({
      title: t('mcp.tools'),
      html: tools.map((tool: any) => `<li><b>${tool.name}</b><br/>${tool.description}</li>`).join(''),
      customClass: { confirmButton: 'alert-confirm', htmlContainer: 'list' },
      confirmButtonText: t('common.close'),
    })
  } else {
    Dialog.show({
      title: t('mcp.noTools'),
      confirmButtonText: t('common.close'),
    })
  }
}

const onRestart = async () => {
  emit('restart')
}

const getAppConnectUrl = (app: string): string => {
  return `http://localhost:3001/mcp/${app}`
}

const onConnect = async (app: string): Promise<void> => {

  const oauthStatus: OAuthStatus = {}
  const url = getAppConnectUrl(app)
  if (await useMcpServer().initOauth(true, url, {}, oauthStatus)) {
    await setupOAuth(app, url, oauthStatus)
  }
}

const setupOAuth = async (app: string, url: string, oauthStatus: OAuthStatus) => {
  const oauthConfig = await useMcpServer().setupOAuth(url, oauthStatus)
  if (oauthConfig) {

    // build a dummy server
    const server: McpServer = {
      uuid: null,
      registryId: null,
      state: 'enabled',
      type: 'http',
      label: app,
      url: url,
      oauth: JSON.parse(JSON.stringify(oauthConfig)),
    }

    // save it
    mcpLoading.value = app
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
      env: result.value.env || {}
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
        await window.api.mcp.deleteServer(server.registryId)
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
  
  .hero {
    padding: 2rem 4rem 0;
    max-width: 1000px;
    margin: 0 auto;
  }
  
  .hero-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .hero-card {
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
  
  .hero-card:hover {
    background: var(--hover-background);
    border-color: var(--accent-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .hero-card.loading {
    cursor: wait;
    opacity: 0.7;
  }
  
  .card-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
  }
  
  .card-content {
    flex: 1;
  }
  
  .card-content h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-color);
  }
  
  .card-content p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--faded-text-color);
    line-height: 1.4;
  }
  
  .card-action {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    color: var(--accent-color);
    opacity: 0.6;
    transition: opacity 0.2s ease;
  }
  
  .hero-card:hover .card-action {
    opacity: 1;
  }
  
  .card-spinner {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
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
  
  .server-info:hover {
    background-color: var(--hover-background);
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
    width: 1.25rem;
    height: 1.25rem;
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
