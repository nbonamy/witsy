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

    <main>
      <div v-if="!props.servers?.length" class="empty-state">
        {{ t('mcp.noServersFound') }}
      </div>
      
      <table v-else class="table-plain table-plain-spaced">
        <thead>
          <tr>
            <th>&nbsp;</th>
            <th>{{ t('mcp.server') }}</th>
            <th>{{ t('common.type') }}</th>
            <th>{{ t('common.actions') }}</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="server in props.servers" :key="server.uuid" class="panel-item">
            <td>
              <span class="status-indicator">{{ getStatus(server) }}</span>
            </td>
            <td @click="onEdit(server)" class="server-info clickable info">
              <div class="text">{{ getDescription(server) }}</div>
            </td>
            <td>{{ getType(server) }}</td>
            <td>
              <div class="actions">
                <!-- Start/Stop button -->
                <PlayIcon 
                  v-if="server.state === 'disabled'"
                  class="start" 
                  v-tooltip="{ text: t('mcp.tooltips.startServer'), position: 'top-left' }" 
                  @click.stop="onEnabled(server)" 
                />
                <StopCircleIcon 
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
import { PlayIcon, PlusIcon, PowerIcon, RefreshCwIcon, SearchIcon, StopCircleIcon } from 'lucide-vue-next'
import Swal from 'sweetalert2/dist/sweetalert2.js'
import { nextTick, PropType, ref } from 'vue'
import ContextMenuTrigger from '../components/ContextMenuTrigger.vue'
import Spinner from '../components/Spinner.vue'
import Dialog from '../composables/dialog'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { McpServer, McpServerStatus } from '../types/mcp'

const props = defineProps({
  servers: Array as PropType<McpServer[]>,
  status: Object,
  loading: Boolean
})

const selected = ref(null)

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
  
  main {
    padding: 4rem;
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
  
  .subtext {
    font-size: 0.9rem;
    color: var(--faded-text-color);
  }
}

</style>
