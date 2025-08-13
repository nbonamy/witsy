<template>
  <div class="mcp-server-list">
    <!-- <div class="description">
      {{ t('settings.mcp.description') }}
      <a href="https://docs.anthropic.com/en/docs/build-with-claude/mcp" target="_blank">{{ t('settings.mcp.modelContextProtocol') }}</a> (MCP)
      {{ t('settings.mcp.servers') }}
      <a href="https://smithery.ai" target="_blank">{{ t('settings.mcp.smithery') }}</a>.
    </div> -->
    <!--div class="description status" v-if="status">
      <span v-if="status.servers == 0">{{ t('settings.mcp.noServersFound') }}</span>
      <span v-else><b>
        <span>{{ t('settings.mcp.connectedToServers', { count: status.servers }) }}</span>
        <span v-if="status.tools > 0"><br/>{{ t('settings.mcp.totalTools', { count: status.tools }) }}</span>
        <span v-else><br/>{{ t('settings.mcp.noTools') }}</span>
      </b></span>
    </div-->
    <!-- <div class="form-field horizontal">
      <input type="checkbox" v-model="enabled" @change="save" />
      <label>{{ t('common.enabled') }}</label>
    </div> -->
    <div class="servers panel">
      <div class="panel-header">
        <label>{{ t('settings.mcp.mcpServers') }}</label>
        <Spinner v-if="loading" />
        <BIconArrowClockwise class="icon reload" v-tooltip="{ text: t('settings.mcp.tooltips.refreshServers'), position: 'bottom-left' }" @click.prevent="onReload" />
        <BIconArrowRepeat class="icon restart" v-tooltip="{ text: t('settings.mcp.tooltips.restartServers'), position: 'bottom-left' }" @click.prevent="onRestart" />
      </div>
      <div class="panel-empty" v-if="!servers.length">
        {{ t('settings.mcp.noServersFound') }}
      </div>
      <div class="panel-body" v-else>
        <template v-for="server in servers" :key="server.uuid">
          <div class="panel-item">

            <div class="icon leading center">
              <a @click.prevent="showLogs(server)" v-if="hasLogs(server)">{{ getStatus(server) }}</a>
              <span v-else>{{ getStatus(server) }}</span>
            </div>

            <div class="info" @click="onEdit(server)">
              <div class="text">{{ getDescription(server) }}</div>
              <div class="subtext">{{ getType(server) }}</div>
            </div>

            <div class="actions">
              
              <div class="start"
                :style="{ display: server.state == 'disabled' ? 'block' : 'none' }"
                v-tooltip="{ text: t('settings.mcp.tooltips.startServer'), position: 'top-left' }"
                @click="onEnabled(server)"><BIconPlayCircle /></div>
              
              <div class="stop" 
                :style="{ display: server.state == 'enabled' ? 'block' : 'none' }"
                v-tooltip="{ text: t('settings.mcp.tooltips.stopServer'), position: 'top-left' }"
                @click="onEnabled(server)"><BIconStopCircle /></div>
              
              <div class="logs" :class="{ 'disabled': !isRunning(server) }"
                :style="{ display: hasLogs(server) ? 'block' : 'none' }"
                v-tooltip="{ text: t('settings.mcp.tooltips.viewLogs'), position: 'top-left' }"
                @click="showLogs(server)"><BIconJournalText /></div>
              
              <BIconSearch class="tools" 
                :class="{ 'disabled': !isRunning(server) }"
                v-tooltip="{ text: t('settings.mcp.tooltips.viewTools'), position: 'top-left' }"
                @click="showTools(server)" />
              
              <BIconPencil class="edit" 
                v-tooltip="{ text: t('settings.mcp.tooltips.editServer'), position: 'top-left' }"
                @click="onEdit(server)" />
              
              <BIconTrash class="delete" 
                v-tooltip="{ text: t('settings.mcp.tooltips.deleteServer'), position: 'top-left' }"
                @click="onDelete(server)" />
            
              </div>

          </div>
        </template>
      </div>
      <div class="panel-footer">
        <button name="addCustom" @click="onCreate('stdio')"><BIconPlusLg /> {{ t('settings.mcp.addCustomServer') }}</button>
        <button name="addSmithery" @click="onCreate('smithery')" v-if="store.isFeatureEnabled('mcp.smithery')"><BIconCloudPlus /> {{ t('settings.mcp.importSmitheryServer') }}</button>
        <button name="addJson" @click="onImportJson" v-if="store.isFeatureEnabled('mcp.json')"><BIconBraces /> {{ t('settings.mcp.importJson.menu') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, nextTick } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { McpServer, McpServerStatus } from '../types/mcp'
import Dialog from '../composables/dialog'
import Spinner from '../components/Spinner.vue'
import Swal from 'sweetalert2/dist/sweetalert2.js'
import { BIconPlusLg } from 'bootstrap-icons-vue'

const servers = ref([])
const status = ref(null)
const selected = ref(null)
const loading = ref(false)

const emit = defineEmits([ 'edit', 'create' ])

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
  const s = status.value?.servers.find((s: McpServerStatus) => s.uuid == server.uuid)
  return s ? true : false
}

const getStatus = (server: McpServer) => {
  if (server.state == 'disabled') return '🔶'
  return isRunning(server) ? '✅' : '❌'
}

const hasLogs = (server: McpServer) => {
  return status.value?.logs?.[server.uuid]
}

const load = async () => {
  loading.value = true
  nextTick(async () => {
    const now = new Date().getTime()
    servers.value = await window.api.mcp.getServers()
    status.value = await window.api.mcp.getStatus()
    setTimeout(() => {
      loading.value = false
    }, 1000 - (new Date().getTime() - now))
  })
}

const onReload = async () => {
  load()
}

const showLogs = (server: McpServer) => {
  Dialog.show({
    title: t('settings.mcp.serverLogs'),
    text: status.value.logs[server.uuid].join(''),
    confirmButtonText: t('common.close'),
  })
}

const showTools = async (server: McpServer) => {
  const tools = await window.api.mcp.getServerTools(server.registryId)
  if (tools.length) {
    Dialog.show({
      title: t('settings.mcp.tools'),
      html: tools.map((tool: any) => `<li><b>${tool.name}</b><br/>${tool.description}</li>`).join(''),
      customClass: { confirmButton: 'alert-confirm', htmlContainer: 'list' },
      confirmButtonText: t('common.close'),
    })
  } else {
    Dialog.show({
      title: t('settings.mcp.noTools'),
      confirmButtonText: t('common.close'),
    })
  }
}

const onRestart = async () => {
  loading.value = true
  status.value = { servers: [], logs: {} }
  nextTick(async () => {
    await window.api.mcp.reload()
    load()
  })
}

const onCreate = (type: string) => {
  emit('create', type)
}

const onImportJson = async () => {

  const result = await Dialog.show({
    title: t('settings.mcp.importJson.title'),
    text: t('settings.mcp.importJson.details'),
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
    loading.value = true
    nextTick(async () => {
      await window.api.mcp.editServer(server)
      load()
    })

  }

}

const onDelete = async (server: McpServer) => {
  if (!server) return
  Dialog.show({
    target: document.querySelector('.settings .plugins'),
    title: t('settings.mcp.confirmDelete'),
    text: t('common.confirmation.cannotUndo'),
    confirmButtonText: t('common.delete'),
    showCancelButton: true,
  }).then(async (result) => {
    if (result.isConfirmed) {
      loading.value = true
      nextTick(async () => {
        await window.api.mcp.deleteServer(server.registryId)
        selected.value = null
        load()
      })
    }
  })
}

const onEnabled = async (server: McpServer) => {
  loading.value = true
  nextTick(async () => {
    server.state = (server.state == 'enabled' ? 'disabled' : 'enabled')
    await window.api.mcp.editServer(JSON.parse(JSON.stringify(server)))
    load()
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
    throw new Error(t('settings.mcp.importJson.errorEmpty'))
  }
  if (!json.startsWith('{')) {
    json = `{${json}}`
  }

  // parse it (might throw a syntax error)
  let dict
  try {
    dict = JSON.parse(json)
  } catch {
    throw new Error(t('settings.mcp.importJson.errorFormat'))
  }
  
  // need an object with exactly one key
  if (typeof dict !== 'object') throw new Error(t('settings.mcp.importJson.errorFormat'))
  if (Object.keys(dict).length != 1) throw new Error(t('settings.mcp.importJson.errorMultiple'))

  // get the server and check command and args
  const server = dict[Object.keys(dict)[0]]
  if (typeof server.command !== 'string' || !server.command?.length) throw new Error(t('settings.mcp.importJson.errorCommand'))
  if (!Array.isArray(server.args)) throw new Error(t('settings.mcp.importJson.errorArgs'))
  
  // done
  return server

}

defineExpose({
  load,
  setLoading: (value: boolean) => {
    loading.value = value
  },
})

</script>


<style scoped>

.servers {
  font-size: 110%;
}

</style>
