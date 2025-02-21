
<template>
  <div>
    <div class="description">
      This plugin allows LLM engines to access <a href="https://docs.anthropic.com/en/docs/build-with-claude/mcp" target="_blank">Model Context Protocol</a> (MCP) servers.
      Discover and install MCP servers from the <a href="https://smithery.ai" target="_blank">Smithery</a>.
    </div>
    <!--div class="description status" v-if="status">
      <span v-if="status.servers == 0">No MCP Servers found</span>
      <span v-else><b>
        <span>Connected to {{ status.servers }} MCP server{{ status.servers > 1 ? 's' : '' }}</span>
        <span v-if="status.tools > 0"><br/>Total of {{ status.tools }} service{{ status.tools > 1 ? 's' : '' }} available</span>
        <span v-else><br/>No tools available</span>
      </b></span>
    </div-->
    <div class="group">
      <label>Enabled</label>
      <input type="checkbox" v-model="enabled" @change="save" />
    </div>
    <div class="servers list-with-actions">
      <div class="title">
        <span v-if="servers.length">MCP Servers:</span>
        <span v-else>No MCP Servers configured</span>
      </div>
      <div class="sticky-table-container" v-if="servers.length">
        <table class="list">
          <thead>
            <tr>
              <th>&nbsp;</th>
              <th>Type</th>
              <th>Target</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="server in servers" :key="server.uuid" :class="{ selected: selected == server }" @click="selected = server" @dblclick="edit(server)">
              <td class="enabled"><input type="checkbox" :checked="server.state=='enabled'" @click="onEnabled(server)" /></td>
              <td>{{ getType(server) }}</td>
              <td>{{ getDescription(server) }}</td>
              <td>
                <a @click.prevent="showLogs(server)" v-if="hasLogs(server)">{{ getStatus(server) }}</a>
                <span v-else>{{ getStatus(server) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="actions">
        <button ref="plusButton" class="button add" @click.prevent="onCreate"><BIconPlus /></button>
        <button class="button remove" @click.prevent="onDelete" v-if="servers.length"><BIconDash /></button>
      </div>
      <div style="margin-top: 16px">
        <button @click.prevent="load">Refresh</button>
        <button @click.prevent="onRestart">Restart client</button>
      </div>
    </div>
    <McpServerEditor ref="editor" :server="selected" @save="onEdited" />
  </div>
</template>

<script setup lang="ts">

import { McpServer, McpServerStatus } from '../types/mcp'
import { ref } from 'vue'
import { store } from '../services/store'
import McpServerEditor from '../screens/McpServerEditor.vue'
import Dialog from '../composables/dialog'

const editor = ref(null)
const enabled = ref(false)
const servers = ref([])
const status = ref(null)
const selected = ref(null)

const getType = (server: McpServer) => {
  if (server.url.includes('@smithery/cli')) return 'smithery'
  else return server.type
}

const getDescription = (server: McpServer) => {
  if (server.type == 'sse') return server.url
  if (server.url.includes('@smithery/cli')) return server.url.replace('-y @smithery/cli@latest run ', '').split(' ')[0]
  if (server.type == 'stdio') return server.command.split('/').pop() + ' ' + server.url
}

const getStatus = (server: McpServer) => {
  if (server.state == 'disabled') return '🔶'
  const s = status.value?.servers.find((s: McpServerStatus) => s.uuid == server.uuid)
  return s ? '✅' : '❌'
}

const hasLogs = (server: McpServer) => {
  return status.value?.logs?.[server.uuid]
}

const load = async () => {
  enabled.value = store.config.plugins.mcp.enabled || false
  servers.value = window.api.mcp.getServers()
  status.value = window.api.mcp.getStatus()
}

const save = async () => {
  store.config.plugins.mcp.enabled = enabled.value
  store.saveSettings()
}

const showLogs = (server: McpServer) => {
  Dialog.show({
    title: 'MCP Server Logs',
    text: status.value.logs[server.uuid].join(''),
    confirmButtonText: 'Close',
  })
}

const onRestart = async () => {
  await window.api.mcp.reload()
  load()
}

const onCreate = () => {
  selected.value = { uuid: null, state: 'enabled', type: 'stdio', command: '', url: '' }
  editor.value.show()
}

const onDelete = async () => {
  if (!selected.value) return
  Dialog.show({
    target: document.querySelector('.settings .plugins'),
    title: 'Are you sure you want to delete this server?',
    text: 'You can\'t undo this action.',
    confirmButtonText: 'Delete',
    showCancelButton: true,
  }).then(async (result) => {
    if (result.isConfirmed) {
      await window.api.mcp.deleteServer(selected.value.uuid)
      selected.value = null
      load()
    }
  })
}

const onEnabled = async (server: McpServer) => {
  server.state = (server.state == 'enabled' ? 'disabled' : 'enabled')
  await window.api.mcp.editServer(JSON.parse(JSON.stringify(server)))
  load()
}

const edit = (server: McpServer) => {
  selected.value = server
  editor.value.show()
}

// @ts-expect-error lazy
const onEdited = async ({ type, command, url }) => {

  // build a dummy server
  const server: McpServer = {
    uuid: selected.value.uuid,
    state: selected.value.state,
    type, command, url
  }

  // edit it
  await window.api.mcp.editServer(server)
  
  // reload
  load()

}

// @ts-expect-error lazy
const onInstall = async ({ registry, server }) => {
  await window.api.mcp.installServer(registry, server)
  load()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
@import '../../css/panel.css';
@import '../../css/list-with-actions.css';
@import '../../css/sticky-header-table.css';
</style>

<style>
.status {
  font-weight: bold;
}

.servers {
  
  margin-top: 16px;
  padding-left: 32px;
  padding-right: 16px;

  .title {
    font-size: 10pt;
    margin-bottom: 8px;
  }

  .sticky-table-container {
    height: auto !important;
    max-height: 100px !important;
    margin-bottom: 0px !important;
  }

  .list {
    width: 100% !important;

    td {
      padding-top: 3px !important;
      padding-bottom: 3px !important;

      max-width: 200px;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;

      a {
        cursor: pointer;
      }
    }
  }
}

</style>
