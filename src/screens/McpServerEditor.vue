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
        <input type="text" v-model="url" autofocus spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
      </div>
      <div class="group" v-if="type === 'smithery'">
        <label>Server Package</label>
        <div class="subgroup">
          <input type="text" v-model="url" autofocus spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
          <a href="https://smithery.ai" target="_blank">Browse Smithery.ai</a>
        </div>
      </div>
      <div class="group" v-if="type === 'stdio'">
        <label>Command</label>
        <input type="text" v-model="command" autofocus spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false"/>
        <div style="width: 100%;">
          <select v-model="source" @change="findCommand">
            <option value="">Select command</option>
            <option value="python3">python</option>
            <option value="uvx">uvx</option>
            <option value="node">node</option>
            <option value="npx">npx</option>
            <option value="pick">Pick File</option>
          </select>
        </div>
      </div>
      <div class="group" v-if="type === 'stdio'">
        <label>Arguments</label>
        <div style="display: flex; width: 100%;">
          <input type="text" v-model="url" spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
          <button @click="pickScript">Pick</button>
        </div>
      </div>
    </template> 
    <template v-slot:footer>
      <div class="buttons">
        <button @click="onCancel" class="alert-neutral" formnovalidate>Cancel</button>
        <button @click="onSave" class="alert-confirm">{{ type === 'smithery' ? 'Install' : 'Save' }}</button>
      </div>
    </template>
  </AlertDialog>
</template>

<script setup lang="ts">

import { ref, onMounted, watch, PropType } from 'vue'
import { type McpServer } from '../types/mcp'
import Dialog from '../composables/dialog'
import AlertDialog from '../components/AlertDialog.vue'

const dialog = ref(null)
const type = ref('stdio')
const command = ref('')
const source = ref('')
const url = ref('')

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

  if (type.value === 'smithery') {
    install('smithery', url.value)
    return
  }

  close()

  emit('save', {
    type: type.value,
    command: command.value,
    url: url.value,
  })

}

const install = async (registry: string, server: string) => {
  const rc = await window.api.mcp.installServer(registry, server)
  if (!rc) {
    Dialog.alert('Failed to install server')
    return
  }

  close()
  emit('save')
}

defineExpose({
  show: () => dialog.value.show('#mcp-server-editor'),
  close,
})

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>
