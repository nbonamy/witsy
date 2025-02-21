<template>
  <AlertDialog id="mcp-server-editor" ref="dialog" @keydown.enter.prevent @keyup.enter="onSave">
    <template v-slot:header>
      <div class="title">MCP Server Configuration</div>
    </template>
    <template v-slot:body>
      <div class="group">
        <label>Type</label>
        <select name="type" v-model="type">
          <option value="stdio">stdio</option>
          <option value="sse">SSE</option>
          <option value="smithery" v-if="!server?.uuid">Smithery.ai</option>
        </select>
      </div>
      <div class="group" v-if="type === 'sse'">
        <label>URL</label>
        <input type="text" name="url" v-model="url" autofocus spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
      </div>
      <div class="group" v-if="type === 'smithery'">
        <label>Server Package</label>
        <div class="subgroup">
          <input type="text" name="url" v-model="url" autofocus spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
          <a href="https://smithery.ai" target="_blank">Browse Smithery.ai</a>
        </div>
      </div>
      <div class="group" v-if="type === 'stdio'">
        <label>Command</label>
        <div style="display: flex; width: 100%;">
          <input type="text" name="command" v-model="command" autofocus spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
          <button name="pickCommand" @click="pickCommand">Pick</button>
        </div>
        <div style="width: 100%;">
          <select name="source" v-model="source" @change="findCommand">
            <option value="">Select command</option>
            <option value="python3">python</option>
            <option value="uvx">uvx</option>
            <option value="node">node</option>
            <option value="npx">npx</option>
            <option value="bun">bun</option>
            <option value="bunx">bunx</option>
          </select>
        </div>
      </div>
      <div class="group" v-if="type === 'stdio'">
        <label>Arguments</label>
        <div style="display: flex; width: 100%;">
          <input type="text" name="url" v-model="url" spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
          <button name="pickScript" @click="pickScript">Pick</button>
        </div>
      </div>
      <div class="group" v-if="type === 'stdio'">
        <label>Environment Variables</label>
        <div class="list-with-actions">
          <div class="sticky-table-container">
            <table class="list">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(value, key) in env" :key="key" :class="{ selected: selectedVar?.key == key }" @click="onSelectVar(key as string)" @dblclick="onEditVar(key as string)">
                  <td>{{ key }}</td>
                  <td>{{ value }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="actions">
            <button ref="addButton" class="button add" @click.prevent="onAddVar"><BIconPlus /></button>
            <button class="button remove" @click.prevent="onDelVar" :disabled="!selectedVar"><BIconDash /></button>
          </div>
        </div>
      </div>
    </template>
    <template v-slot:footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="alert-neutral" formnovalidate>Cancel</button>
        <button name="save" @click="onSave" class="alert-confirm">{{ type === 'smithery' ? 'Install' : 'Save' }}</button>
      </div>
    </template>
  </AlertDialog>
  <McpVariableEditor ref="editor" :variable="selectedVar" @save="onSaveVar" />
</template>

<script setup lang="ts">

import { Ref, ref, onMounted, watch, PropType } from 'vue'
import { McpServer } from '../types/mcp'
import Dialog from '../composables/dialog'
import AlertDialog from '../components/AlertDialog.vue'
import McpVariableEditor from './McpVariableEditor.vue'

const dialog = ref(null)
const editor = ref(null)
const type = ref('stdio')
const command = ref('')
const source = ref('')
const url = ref('')
const env: Ref<{ [key: string]: string }> = ref({})
const selectedVar: Ref<{ key: string, value: string }> = ref(null)

const props = defineProps({
  server: {
    type: Object as PropType<McpServer>,
    default: () => ({}),
  },
})

const emit = defineEmits(['save', 'install'])

onMounted(async () => {
  watch(() => props.server || {}, () => {
    type.value = props.server?.type || 'stdio'
    command.value = props.server?.command || ''
    url.value = props.server?.url || ''
    env.value = props.server?.env || {}
  }, { immediate: true })
})

const close = () => {
  dialog.value.close('#mcp-server-editor')
}

const onCancel = () => {
  close()
}

const findCommand = () => {
  if (source.value == '') {
    return
  }
  if (source.value == 'pick') {
    pickCommand()
    return
  }
  const path = window.api.file.find(source.value)
  if (path) {
    command.value = path
  } else {
    command.value = source.value
  }
  source.value = ''
}

const pickCommand = () => {
  const path = window.api.file.pick({ location: true })
  if (path) {
    command.value = path as string
  }
  source.value = ''
}

const pickScript = () => {
  const path = window.api.file.pick({ location: true })
  if (path) {
    url.value = path as string
  }
}

const onSelectVar = (key: string) => {
  selectedVar.value = { key, value: env.value[key] }
}

const onAddVar = () => {
  selectedVar.value = { key: '', value: '' }
  editor.value.show()
}

const onDelVar = () => {
  if (selectedVar.value) {
    delete env.value[selectedVar.value.key]
    env.value = { ...env.value }
  }
}

const onEditVar = (key: string) => {
  selectedVar.value = { key, value: env.value[key] }
  editor.value.show()
}

const onSaveVar = (variable: { key: string, value: string }) => {
  if (variable.key.length) {
    if (variable.key != selectedVar.value.key) {
      delete env.value[selectedVar.value.key]
    }
    env.value[variable.key] = variable.value
    env.value = { ...env.value }
  }
}

const onSave = () => {

  if (type.value === 'stdio' && !command.value.length) {
    Dialog.show({
      title: 'Some fields are required',
      text: 'Make sure you enter a command for this server.',
      confirmButtonText: 'OK',
    })
    return
  }

  if (type.value === 'sse' && !url.value.length) {
    Dialog.show({
      title: 'Some fields are required',
      text: 'Make sure you enter a URL for this server.',
      confirmButtonText: 'OK',
    })
    return
  }

  if (type.value === 'smithery' && !url.value.length) {
    Dialog.show({
      title: 'Some fields are required',
      text: 'Make sure you enter a package name for this server.',
      confirmButtonText: 'OK',
    })
    return
  }

  close()

  if (type.value === 'smithery') {

    emit('install', {
      registry: type.value,
      server: url.value
    })

  } else {

    emit('save', {
      type: type.value,
      command: command.value,
      url: url.value,
      env: JSON.parse(JSON.stringify(env.value)),
    })

  }

}

defineExpose({
  show: () => dialog.value.show('#mcp-server-editor'),
  close,
})

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/list-with-actions.css';
@import '../../css/sticky-header-table.css';
</style>

<style scoped>
#mcp-server-editor {

  .list-with-actions {
    width: 100%;
  }

  .sticky-table-container {
    height: 100px;

    td {
      max-width: 110px;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    }
  }
}
</style>