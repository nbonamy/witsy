<template>
  <div>
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
    <!-- <div class="group horizontal">
      <input type="checkbox" v-model="enabled" @change="save" />
      <label>{{ t('common.enabled') }}</label>
    </div> -->
    <div class="servers list-large-with-header">
      <div class="header">
        <label>{{ t('settings.mcp.mcpServers') }}</label>
        <Spinner v-if="loading" />
        <BIconPlusLg class="icon add" ref="addButton" @click.prevent="onAdd"></BIconPlusLg>
        <BIconArrowClockwise class="icon reload" @click.prevent="onReload" />
        <BIconArrowRepeat class="icon restart" @click.prevent="onRestart" />
      </div>
      <div class="list" v-if="servers.length">
        <template v-for="server in servers" :key="server.uuid">
          <div class="item">

            <div class="icon leading center">
              <a @click.prevent="showLogs(server)" v-if="hasLogs(server)">{{ getStatus(server) }}</a>
              <span v-else>{{ getStatus(server) }}</span>
            </div>

            <div class="info" @click="onEdit(server)">
              <div class="text">{{ getDescription(server) }}</div>
              <div class="subtext">{{ getType(server) }}</div>
            </div>

            <div class="actions">
              <BIconPlayCircle class="start" @click="onEnabled(server)" v-if="server.state == 'disabled'"/>
              <BIconStopCircle class="stop" @click="onEnabled(server)" v-if="server.state == 'enabled'"/>
              <BIconJournalText class="logs" @click="showLogs(server)" v-if="hasLogs(server)"/>
              <BIconSearch class="tools" @click="showTools(server)" :class="{ 'disabled': !isRunning(server) }"/>
              <BIconPencil class="edit" @click="onEdit(server)" />
              <BIconTrash class="delete" @click="onDelete(server)" />
            </div>

          </div>
        </template>
      </div>
      <div class="empty" v-else>
        {{ t('settings.mcp.noServersFound') }}
      </div>
    </div>
  </div>
  <ContextMenu v-if="showAddMenu" :on-close="closeAddMenu" :actions="addMenuActions" @action-clicked="handleAddAction" :x="addMenuX" :y="addMenuY" position="right"/>
</template>

<script setup lang="ts">

import { ref, nextTick } from 'vue'
import { t } from '../services/i18n'
import { McpServer, McpServerStatus } from '../types/mcp'
import ContextMenu from '../components/ContextMenu.vue'
import Dialog from '../composables/dialog'
import Spinner from '../components/Spinner.vue'
import Swal from 'sweetalert2/dist/sweetalert2.js'

const addButton = ref(null)
const servers = ref([])
const status = ref(null)
const selected = ref(null)
const showAddMenu = ref(false)
const addMenuX = ref(0)
const addMenuY = ref(0)
const loading = ref(false)

const emit = defineEmits([ 'edit', 'create' ])

const getType = (server: McpServer) => {
  if (server.url.includes('@smithery/cli')) return 'smithery'
  else return server.type
}

const getDescription = (server: McpServer) => {
  if (server.title && server.title.trim().length) return server.title
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

const addMenuActions = [
  { label: t('settings.mcp.addCustomServer'), action: 'custom' },
  { label: t('settings.mcp.importSmitheryServer'), action: 'smithery' },
  { label: t('settings.mcp.importJson.menu'), action: 'json' },
]

const onAdd = () => {
  const addButton = document.querySelector('.servers .icon.add')
  const rc = addButton?.getBoundingClientRect()
  addMenuX.value = 200
  addMenuY.value = rc?.top - 32
  showAddMenu.value = true
}

const closeAddMenu = () => {
  showAddMenu.value = false
}

const handleAddAction = (action: string) => {
  closeAddMenu()
  if (action === 'custom') {
    onCreate('stdio')
  } else if (action === 'smithery') {
    onCreate('smithery')
  } else if (action === 'json') {
    onImportJson()
  }
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
    customClass: { icon: 'hidden', input: 'auto-height' },
    inputValue: '',
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
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/list-large-with-header.css';
</style>

<style scoped>

.servers {
  font-size: 110%;
}

</style>
