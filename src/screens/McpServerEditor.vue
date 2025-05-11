<template>
  <AlertDialog id="mcp-server-editor" ref="dialog" :icon="false" @keydown.enter.prevent @keyup.enter="onSave">
    <template v-slot:header>
      <div class="title">{{ t('mcp.serverEditor.title') }}</div>
    </template>
    <template v-slot:body>
      <div class="group">
        <label>{{ t('common.type') }}</label>
        <select name="type" v-model="type">
          <option value="stdio">{{ t('mcp.serverEditor.type.stdio') }}</option>
          <option value="sse">{{ t('mcp.serverEditor.type.sse') }}</option>
          <option value="smithery" v-if="!server?.uuid">{{ t('mcp.serverEditor.type.smithery') }}</option>
        </select>
      </div>
      <div class="group" v-if="type === 'sse'">
        <label>{{ t('common.url') }}</label>
        <input type="text" name="url" v-model="url" autofocus spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
      </div>
      <div class="group" v-if="type === 'smithery'">
        <label>{{ t('mcp.serverEditor.serverPackage') }}</label>
        <div class="subgroup">
          <input type="text" name="url" v-model="url" autofocus spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
          <a href="https://smithery.ai" target="_blank">{{ t('common.browse') }} Smithery.ai</a>
        </div>
      </div>
      <div class="group" v-if="type === 'stdio'">
        <label>{{ t('common.command') }}</label>
        <div class="control-group">
          <input type="text" name="command" v-model="command" autofocus spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
          <button name="pickCommand" @click="pickCommand">{{ t('common.pick') }}</button>
        </div>
        <div style="width: 100%;">
          <select name="source" v-model="source" @change="findCommand">
            <option value="">{{ t('mcp.serverEditor.selectCommand') }}</option>
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
        <label>{{ t('common.arguments') }}</label>
        <div class="control-group">
          <input type="text" name="url" v-model="url" spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
          <button name="pickScript" @click="pickScript">{{ t('common.pick') }}</button>
        </div>
      </div>
      <div class="group" v-if="type === 'stdio'">
        <label>{{ t('mcp.serverEditor.workingDirectory') }}</label>
        <div class="control-group">
          <input type="text" name="cwd" v-model="cwd" spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
          <button name="pickWorkDir" @click="pickWorkDir">{{ t('common.pick') }}</button>
        </div>
      </div>
      <div class="group" v-if="type === 'stdio'">
        <label>{{ t('mcp.serverEditor.environmentVariables') }}</label>
        <VariableTable 
          :variables="env"
          :selectedVariable="selectedVar"
          @select="onSelectVar"
          @add="onAddVar"
          @edit="onEditVar"
          @delete="onDelVar"
        />
      </div>
    </template>
    <template v-slot:footer>
      <div class="buttons">
        <button name="cancel" @click="onCancel" class="alert-neutral" formnovalidate>{{ t('common.cancel') }}</button>
        <button name="save" @click="onSave" class="alert-confirm">{{ type === 'smithery' ? t('common.install') : t('common.save') }}</button>
      </div>
    </template>
  </AlertDialog>
  <VariableEditor ref="editor" title="mcp.variableEditor.title" :variable="selectedVar" @save="onSaveVar" />
</template>

<script setup lang="ts">

import { Ref, ref, onMounted, watch, PropType } from 'vue'
import { McpServer } from '../types/mcp'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import AlertDialog from '../components/AlertDialog.vue'
import VariableEditor from './VariableEditor.vue'
import VariableTable from '../components/VariableTable.vue'

const dialog = ref(null)
const editor = ref(null)
const type = ref('stdio')
const command = ref('')
const source = ref('')
const url = ref('')
const cwd = ref('')
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
    cwd.value = props.server?.cwd || ''
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

const pickWorkDir = () => {
  const path = window.api.file.pickDir()
  if (path) {
    cwd.value = path as string
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
      title: t('mcp.serverEditor.validation.requiredFields'),
      text: t('mcp.serverEditor.validation.commandRequired'),
      confirmButtonText: t('common.ok'),
    })
    return
  }

  if (type.value === 'sse' && !url.value.length) {
    Dialog.show({
      title: t('mcp.serverEditor.validation.requiredFields'),
      text: t('mcp.serverEditor.validation.urlRequired'),
      confirmButtonText: t('common.ok'),
    })
    return
  }

  if (type.value === 'smithery' && !url.value.length) {
    Dialog.show({
      title: t('mcp.serverEditor.validation.requiredFields'),
      text: t('mcp.serverEditor.validation.packageRequired'),
      confirmButtonText: t('common.ok'),
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
      cwd: cwd.value,
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

<style>
#mcp-server-editor {

  width: 300px !important;

  .list-with-actions {
    width: 100%;
  }

  .sticky-table-container {

    height: 100px;

    td {
      max-width: 60px;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    }
  }
}
</style>