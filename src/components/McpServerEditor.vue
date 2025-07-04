<template>
  <div class="mcp-server-editor" @keydown.enter.prevent="onSave">
    <div class="group">
      <label>{{ t('common.type') }}</label>
      <select name="type" v-model="type">
        <option value="stdio">{{ t('mcp.serverEditor.type.stdio') }}</option>
        <option value="http">{{ t('mcp.serverEditor.type.http') }}</option>
        <option value="sse">{{ t('mcp.serverEditor.type.sse') }}</option>
        <option value="smithery" v-if="!server?.uuid">{{ t('mcp.serverEditor.type.smithery') }}</option>
      </select>
    </div>
    <div class="group">
      <label>{{ t('common.title') }}</label>
      <input type="text" name="title" v-model="title" spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
    </div>
    <div class="group" v-if="['http', 'sse'].includes(type)">
      <label>{{ t('common.url') }}</label>
      <input type="text" name="url" v-model="url" autofocus spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
    </div>
    <template v-if="type === 'smithery'">
      <div class="group">
        <label>{{ t('mcp.serverEditor.serverPackage') }}</label>
        <div class="subgroup">
          <input type="text" name="url" v-model="url" autofocus spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
          <a href="https://smithery.ai" target="_blank">{{ t('common.browse') }} Smithery.ai</a>
        </div>
      </div>
      <div class="group">
        <label>{{ t('mcp.serverEditor.smitheryApiKey') }}</label>
        <input type="text" name="apiKey" v-model="apiKey" autofocus spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
      </div>
    </template>
    <template v-if="type === 'stdio'">
      <div class="group">
        <label>{{ t('common.command') }}</label>
        <div class="control-group">
          <input type="text" name="command" v-model="command" autofocus spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
          <button name="pickCommand" @click.prevent="pickCommand">{{ t('common.pick') }}</button>
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
      <div class="group">
        <label>{{ t('common.arguments') }}</label>
        <div class="control-group">
          <input type="text" name="url" v-model="url" spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
          <button name="pickScript" @click.prevent="pickScript">{{ t('common.pick') }}</button>
        </div>
      </div>
      <div class="group">
        <label>{{ t('mcp.serverEditor.workingDirectory') }}</label>
        <div class="control-group">
          <input type="text" name="cwd" v-model="cwd" spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
          <button name="pickWorkDir" @click.prevent="pickWorkDir">{{ t('common.pick') }}</button>
        </div>
      </div>
      <div class="group">
        <label>{{ t('mcp.serverEditor.environmentVariables') }}</label>
        <VariableTable 
          :variables="env"
          :selectedVariable="selectedVar"
          @select="onSelectVar('env', $event)"
          @add="onAddVar('env')"
          @edit="onEditVar('env', $event)"
          @delete="onDelVar('env')"
        />
      </div>
    </template>
    <template v-if="type === 'http'">
      <div class="group">
        <label>{{ t('mcp.serverEditor.httpHeaders') }}</label>
        <VariableTable 
          :variables="headers"
          :selectedVariable="selectedVar"
          @select="onSelectVar('header', $event)"
          @add="onAddVar('header')"
          @edit="onEditVar('header', $event)"
          @delete="onDelVar('header')"
        />
      </div>
    </template>
    <div class="buttons">
      <button name="cancel" @click.prevent="onCancel" class="alert-neutral" formnovalidate>{{ t('common.cancel') }}</button>
      <button name="save" @click.prevent="onSave" class="alert-confirm">{{ type === 'smithery' ? t('common.install') : t('common.save') }}</button>
    </div>
  </div>
  <VariableEditor ref="editor" id="mcp-variable-editor" title="mcp.variableEditor.title" :variable="selectedVar" @save="onSaveVar" />
</template>

<script setup lang="ts">

import { strDict } from '../types/index'
import { McpServer, McpServerType } from '../types/mcp'
import { ref, onMounted, watch, PropType } from 'vue'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import VariableEditor from '../screens/VariableEditor.vue'
import VariableTable from '../components/VariableTable.vue'

export type McpCreateType = McpServerType | 'smithery'

export type McpServerVariableType = 'env' | 'header'

export type McpServerVariable = {
  type: McpServerVariableType
  key: string
  value: string
}

const editor = ref(null)
const type = ref('stdio')
const command = ref('')
const source = ref('')
const url = ref('')
const cwd = ref('')
const env = ref<strDict>({})
const headers = ref<strDict>({})
const apiKey = ref('')
const selectedVar = ref<McpServerVariable>(null)
const title = ref('')

const props = defineProps({
  server: {
    type: Object as PropType<McpServer>,
    default: () => ({}),
  },
  type: {
    type: String as PropType<McpCreateType>,
    default: 'stdio',
  },
  apiKey: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['cancel', 'save', 'install'])

onMounted(async () => {
  watch(() => props || {}, async () => {
    type.value = props.type || 'stdio'
    title.value = props.server?.title || ''
    command.value = props.server?.command || ''
    url.value = props.server?.url || ''
    cwd.value = props.server?.cwd || ''
    env.value = props.server?.env || {}
    headers.value = props.server?.headers || {}
    apiKey.value = props.apiKey || ''
  }, { deep: true, immediate: true })
})

const onCancel = () => {
  emit('cancel')
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

const getVarDict = (type: McpServerVariableType) => {
  if (type === 'env') {
    return env.value
  } else if (type === 'header') {
    return headers.value
  }
  return {}
}

const onSelectVar = (type: McpServerVariableType, key: string) => {
  selectedVar.value = { type, key, value: env.value[key] }
}

const onAddVar = (type: McpServerVariableType) => {
  selectedVar.value = { type, key: '', value: '' }
  editor.value.show()
}

const onDelVar = (type: McpServerVariableType) => {
  if (selectedVar.value) {
    let dict = getVarDict(type)
    delete dict[selectedVar.value.key]
    dict = { ...dict }
  }
}

const onEditVar = (type: McpServerVariableType, key: string) => {
  const dict = getVarDict(type)
  selectedVar.value = { type, key, value: dict[key] }
  editor.value.show()
}

const onSaveVar = (variable: McpServerVariable) => {
  console.log(variable)
  if (variable.key.length) {
    let dict = getVarDict(variable.type)
    if (variable.key != selectedVar.value.key) {
      delete dict[selectedVar.value.key]
    }
    dict[variable.key] = variable.value
    dict = { ...dict }
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

  if (type.value === 'smithery') {

    emit('install', {
      registry: type.value,
      server: url.value,
      apiKey: apiKey.value,
    })

  } else {

    const trimmedTitle = title.value.trim()

    const payload: any = {
      type: type.value,
      command: command.value,
      url: url.value,
      cwd: cwd.value,
      env: JSON.parse(JSON.stringify(env.value)),
<<<<<<< HEAD
      headers: JSON.parse(JSON.stringify(headers.value)),
      title: title.value.trim(),
    })
=======
    }

    // include title only when non-empty or when it existed before (allows deletion)
    if (trimmedTitle.length || props.server?.title !== undefined) {
      payload.title = trimmedTitle
    }

    emit('save', payload)
>>>>>>> 64aeed22 (feat: make MCP server title field optional)

  }

}

</script>

<style scoped>
@import '../../css/form.css';
</style>

<style scoped>

.mcp-server-editor {
  
  .list-with-actions {
    width: 100%;
  }

}

</style>
