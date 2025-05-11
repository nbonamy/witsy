<template>
  <form class="tab-content vertical large">
    <header>
      <div class="title">{{ t('settings.plugins.mcp.title') }}</div>
    </header>
    <main>
      <!-- <div class="description">
        {{ t('settings.plugins.mcp.description') }}
        <a href="https://docs.anthropic.com/en/docs/build-with-claude/mcp" target="_blank">{{ t('settings.plugins.mcp.modelContextProtocol') }}</a> (MCP)
        {{ t('settings.plugins.mcp.servers') }}
        <a href="https://smithery.ai" target="_blank">{{ t('settings.plugins.mcp.smithery') }}</a>.
      </div> -->
      <!--div class="description status" v-if="status">
        <span v-if="status.servers == 0">{{ t('settings.plugins.mcp.noServersFound') }}</span>
        <span v-else><b>
          <span>{{ t('settings.plugins.mcp.connectedToServers', { count: status.servers }) }}</span>
          <span v-if="status.tools > 0"><br/>{{ t('settings.plugins.mcp.totalTools', { count: status.tools }) }}</span>
          <span v-else><br/>{{ t('settings.plugins.mcp.noTools') }}</span>
        </b></span>
      </div-->
      <!-- <div class="group horizontal">
        <input type="checkbox" v-model="enabled" @change="save" />
        <label>{{ t('common.enabled') }}</label>
      </div> -->
      <div class="servers">
        <div class="header">
          <label>{{ t('settings.plugins.mcp.mcpServers') }}</label>
          <Spinner v-if="loading" />
          <BIconPlusLg class="icon add" ref="addButton" @click.prevent="onAdd"></BIconPlusLg>
          <BIconArrowClockwise class="icon reload" @click.prevent="onReload" />
          <BIconArrowRepeat class="icon restart" @click.prevent="onRestart" />
        </div>
        <div class="list">
          <template v-for="server in servers" :key="server.uuid">
            <div class="item">

              <div class="icon status center">
                <a @click.prevent="showLogs(server)" v-if="hasLogs(server)">{{ getStatus(server) }}</a>
                <span v-else>{{ getStatus(server) }}</span>
              </div>

              <div class="info" @click="onEdit(server)">
                <div class="name">{{ getDescription(server) }}</div>
                <div class="type">{{ getType(server) }}</div>
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
      </div>
    </main>
    <ContextMenu v-if="showAddMenu" :on-close="closeAddMenu" :actions="addMenuActions" @action-clicked="handleAddAction" :x="addMenuX" :y="addMenuY" position="right"/>
    <McpServerEditor ref="editor" :server="selected" @save="onEdited" @install="onInstall" />
  </form>
</template>

<script setup lang="ts">

import { ref, nextTick } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import { McpServer, McpServerStatus } from '../types/mcp'
import ContextMenu from '../components/ContextMenu.vue'
import McpServerEditor from '../screens/McpServerEditor.vue'
import Dialog from '../composables/dialog'
import Spinner from '../components/Spinner.vue'
import Swal from 'sweetalert2/dist/sweetalert2.js'
import { BIconArrowClockwise, BIconArrowRepeat } from 'bootstrap-icons-vue'

const editor = ref(null)
const addButton = ref(null)
const enabled = ref(false)
const servers = ref([])
const status = ref(null)
const selected = ref(null)
const showAddMenu = ref(false)
const addMenuX = ref(0)
const addMenuY = ref(0)
const loading = ref(false)

const getType = (server: McpServer) => {
  if (server.url.includes('@smithery/cli')) return 'smithery'
  else return server.type
}

const getDescription = (server: McpServer) => {
  if (server.type == 'sse') return server.url
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
  const now = new Date().getTime()
  enabled.value = store.config.plugins.mcp.enabled || false
  servers.value = await window.api.mcp.getServers()
  status.value = await window.api.mcp.getStatus()
  setTimeout(() => {
    loading.value = false
  }, 1000 - (new Date().getTime() - now))
}

// const save = async () => {
//   store.config.plugins.mcp.enabled = enabled.value
//   store.saveSettings()
// }

const onReload = async () => {
  loading.value = true
  nextTick(async () => {
    await load()
  })
}

const showLogs = (server: McpServer) => {
  Dialog.show({
    title: t('settings.plugins.mcp.serverLogs'),
    text: status.value.logs[server.uuid].join(''),
    confirmButtonText: t('common.close'),
  })
}

const showTools = async (server: McpServer) => {
  const tools = await window.api.mcp.getServerTools(server.registryId)
  if (tools.length) {
    Dialog.show({
      title: t('settings.plugins.mcp.tools'),
      html: tools.map((tool: any) => `<li><b>${tool.name}</b><br/>${tool.description}</li>`).join(''),
      customClass: { confirmButton: 'alert-confirm', htmlContainer: 'list' },
      confirmButtonText: t('common.close'),
    })
  } else {
    Dialog.show({
      title: t('settings.plugins.mcp.noTools'),
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
  { label: t('settings.plugins.mcp.addCustomServer'), action: 'custom' },
  { label: t('settings.plugins.mcp.importSmitheryServer'), action: 'smithery' },
  { label: t('settings.plugins.mcp.importJson.menu'), action: 'json' },
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
  selected.value = {
    uuid: null,
    registryId: null,
    state: 'enabled', 
    type: type,
    command: '',
    url: '' 
  }
  editor.value.show()
}

const onImportJson = async () => {

  const result = await Dialog.show({
    title: t('settings.plugins.mcp.importJson.title'),
    text: t('settings.plugins.mcp.importJson.details'),
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
    title: t('settings.plugins.mcp.confirmDelete'),
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
  selected.value = server
  editor.value.show()
}

// @ts-expect-error lazy
const onEdited = async ({ type, command, url, cwd, env }) => {

  // build a dummy server
  const server: McpServer = {
    uuid: selected.value.uuid,
    registryId: selected.value.registryId,
    state: selected.value.state,
    type, command, url, cwd, env
  }

  // edit it
  loading.value = true
  nextTick(async () => {
    await window.api.mcp.editServer(server)
    load()
  })

}

// @ts-expect-error lazy
const onInstall = async ({ registry, server }) => {

  loading.value = true
  nextTick(async () => {

    const rc = await window.api.mcp.installServer(registry, server)
    if (!rc) {
      loading.value = false
      Dialog.show({
        title: t('settings.plugins.mcp.failedToInstall'),
        text: t('settings.plugins.mcp.copyInstallCommand'),
        confirmButtonText: t('common.copy'),
        showCancelButton: true,
      }).then((result) => {
        if (result.isConfirmed) {
          const command = window.api.mcp.getInstallCommand(registry, server)
          navigator.clipboard.writeText(command)
        }
      })
    }

    load()

  })

}

const validateServerJson = (json: string) => {

  // build a proper payload
  json = json.trim()
  if (json.endsWith(',')) {
    json = json.slice(0, -1).trim()
  }
  if (!json.length) {
    throw new Error(t('settings.plugins.mcp.importJson.errorEmpty'))
  }
  if (!json.startsWith('{')) {
    json = `{${json}}`
  }

  // parse it (might throw a syntax error)
  let dict
  try {
    dict = JSON.parse(json)
  } catch {
    throw new Error(t('settings.plugins.mcp.importJson.errorFormat'))
  }
  
  // need an object with exactly one key
  if (typeof dict !== 'object') throw new Error(t('settings.plugins.mcp.importJson.errorFormat'))
  if (Object.keys(dict).length != 1) throw new Error(t('settings.plugins.mcp.importJson.errorMultiple'))

  // get the server and check command and args
  const server = dict[Object.keys(dict)[0]]
  if (typeof server.command !== 'string' || !server.command?.length) throw new Error(t('settings.plugins.mcp.importJson.errorCommand'))
  if (!Array.isArray(server.args)) throw new Error(t('settings.plugins.mcp.importJson.errorArgs'))
  
  // done
  return server

}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/list-with-actions.css';
@import '../../css/sticky-header-table.css';
</style>

<style scoped>

main {
  width: calc(100% - 4rem);
}

.servers {
  
  padding: 2rem;
  padding-top: 0px;
  display: flex;
  flex-direction: column;
  margin: 8px 6px 8px 6px;
  flex-grow: 1;
  overflow: hidden;

  .header {
    
    display: flex;
    flex-direction: row;
    align-items: center;
    font-weight: bold;
    gap: 1rem;

    padding: 1.5rem;
    background-color: var(--window-decoration-color);
    border: 1px solid var(--control-border-color);
    border-bottom-width: 0px;
    border-top-left-radius: 0.5rem;
    border-top-right-radius: 0.5rem;
    margin-bottom: 0px !important;

    label {
      flex: 1;
    }

    .icon {
      cursor: pointer;
      width: 1.25rem;
      height: 1.25rem;
    }

    .spinner {
      transform: scale(125%);
    }

    button {
      margin: 0px;
    }

  }

  .list {

    flex-grow: 1;
    border: 1px solid var(--control-border-color);
    border-bottom-left-radius: 0.5rem;
    border-bottom-right-radius: 0.5rem;

    padding: 1rem;
    
    display: flex;
    flex-direction: column;
    gap: 1rem;
    

    .item {

      padding: 1rem;
      font-size: 9.5pt;
      display: flex;
      flex-direction: row;
      align-items: center;
      border: 0.75px solid var(--control-border-color);
      border-radius: 0.5rem;
      gap: 1rem;

      > .status {
        cursor: pointer;
        text-align: center;
        flex: 0 0 2.5rem;
        font-size: 13pt;
      }
      
      .info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        overflow: hidden;
        cursor: pointer;
        
        .name, .type {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .name {
          font-size: 11pt;
          font-weight: 600;
        }

        .type {
          opacity: 0.6;
        }
      }

      .actions {

        display: flex;
        flex-direction: row;
        align-items: center;
        margin-top: 0px;
        gap: 0.75rem;


        svg {
          width: 1.25rem;
          height: 1.25rem;
          opacity: 0.6;
          cursor: pointer;
        }

        .icon.error:hover {
          color: red;
        }

        .disabled {
          opacity: 0.3;
          pointer-events: none;
        }

      }

    }
  }
}


</style>
