<template>
  <div class="mcp-server-editor form form-vertical form-large" @keydown.enter.prevent="onSave">
    <main>
    <div class="form-field">
      <label>{{ t('common.type') }}</label>
      <select name="type" v-model="type">
        <option value="stdio">{{ t('mcp.serverEditor.type.stdio') }}</option>
        <option value="http">{{ t('mcp.serverEditor.type.http') }}</option>
        <option value="sse">{{ t('mcp.serverEditor.type.sse') }}</option>
        <option value="smithery" v-if="!server?.uuid">{{ t('mcp.serverEditor.type.smithery') }}</option>
      </select>
    </div>
    <div class="form-field">
      <label>{{ t('common.label') }}</label>
      <input type="text" name="label" v-model="label" spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
    </div>
    <div class="form-field" v-if="['http', 'sse'].includes(type)">
      <label>{{ t('common.url') }}</label>
      <input type="text" name="url" v-model="url" autofocus spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
    </div>
    <template v-if="type === 'smithery'">
      <div class="form-field">
        <label>{{ t('mcp.serverEditor.serverPackage') }}</label>
        <div class="form-subgroup">
          <input type="text" name="url" v-model="url" autofocus spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
          <a href="https://smithery.ai" target="_blank">{{ t('common.browse') }} Smithery.ai</a>
        </div>
      </div>
      <div class="form-field">
        <label>{{ t('mcp.serverEditor.smitheryApiKey') }}</label>
        <input type="text" name="apiKey" v-model="apiKey" autofocus spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
      </div>
    </template>
    <template v-if="type === 'stdio'">
      <div class="form-field">
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
      <div class="form-field">
        <label>{{ t('common.arguments') }}</label>
        <div class="control-group">
          <input type="text" name="url" v-model="url" spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
          <button name="pickScript" @click.prevent="pickScript">{{ t('common.pick') }}</button>
        </div>
      </div>
      <div class="form-field">
        <label>{{ t('mcp.serverEditor.workingDirectory') }}</label>
        <div class="control-group">
          <input type="text" name="cwd" v-model="cwd" spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
          <button name="pickWorkDir" @click.prevent="pickWorkDir">{{ t('common.pick') }}</button>
        </div>
      </div>
      <div class="form-field">
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
      <div class="form-field">
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
      <div class="form-field">
        <label>{{ t('mcp.serverEditor.oauth.title') }}</label>
        <template v-if="oauthConfig">
          <div>{{ t('mcp.serverEditor.oauth.successful') }}</div>
          <div><a href="#" @click.prevent="removeOAuth">{{ t('common.delete') }}</a></div>
        </template>
        <template v-else>
          <div class="form-subgroup">
            <div class="form-field">
              <label @click="showAuthFields = !showAuthFields" class="show-auth-fields">
                <BIconCaretRightFill v-if="!showAuthFields" />
                <BIconCaretDownFill v-else />
                {{ t('mcp.serverEditor.oauth.showAuthFields') }}
              </label>
            </div>
            <template  v-if="showAuthFields">
              <div class="form-field">
                <label>{{ t('mcp.serverEditor.oauth.clientId') }}</label>
                <input type="text" name="oauthClientId" v-model="oauthClientId" spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
              </div>
              <div class="form-field">
                <label>{{ t('mcp.serverEditor.oauth.clientSecret') }}</label>
                <input type="password" name="oauthClientSecret" v-model="oauthClientSecret" spellcheck="false" autocapitalize="false" autocomplete="false" autocorrect="false" />
              </div>
            </template>
          </div>
          <div><a href="#" @click.prevent="checkOAuth">{{ t('mcp.serverEditor.oauth.setup') }}</a></div>
        </template>
      </div>
    </template>
    
    <div class="buttons">
      <Spinner v-if="loading" />
      <template v-else>
        <button name="cancel" @click.prevent="onCancel" class="tertiary" formnovalidate>{{ t('common.cancel') }}</button>
        <button name="save" @click.prevent="onSave" class="primary">{{ type === 'smithery' ? t('common.install') : t('common.save') }}</button>
      </template>
    </div>

    <VariableEditor ref="editor" id="mcp-variable-editor" title="mcp.variableEditor.title" :variable="selectedVar" @save="onSaveVar" />

    </main>
  </div>
</template>

<script setup lang="ts">

import { nextTick, onMounted, PropType, ref } from 'vue'
import Spinner from '../components/Spinner.vue'
import VariableTable from '../components/VariableTable.vue'
import Dialog from '../composables/dialog'
import VariableEditor from '../screens/VariableEditor.vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import { strDict } from '../types/index'
import { useMcpServer } from '../composables/mcp'
import { McpInstallStatus, McpServer, McpServerType } from '../types/mcp'

export type McpCreateType = McpServerType | 'smithery'

export type McpServerVariableType = 'env' | 'header'

export type McpServerVariable = {
  type: McpServerVariableType
  key: string
  value: string
}

const editor = ref(null)
const loading = ref(false)
const type = ref<McpServerType|'smithery'>('stdio')
const label = ref('')
const command = ref('')
const source = ref('')
const url = ref('')
const cwd = ref('')
const env = ref<strDict>({})
const headers = ref<strDict>({})
const apiKey = ref('')
const selectedVar = ref<McpServerVariable>(null)
const oauthConfig = ref(null)
const showAuthFields = ref(false)
const oauthClientId = ref('')
const oauthClientSecret = ref('')
const oauthStatus = ref({
  checking: false,
  checked: false,
  required: null,
  metadata: null
})

const props = defineProps({
  server: {
    type: Object as PropType<McpServer>,
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

const emit = defineEmits(['cancel', 'saved', 'install'])

onMounted(async () => {
  // console.log('Initializing McpServerEditor with props:', props)
  type.value = props.type || 'stdio'
  label.value = props.server?.label || ''
  command.value = props.server?.command || ''
  url.value = props.server?.url || ''
  cwd.value = props.server?.cwd || ''
  env.value = props.server?.env || {}
  headers.value = props.server?.headers || {}
  oauthConfig.value = props.server?.oauth || null
  apiKey.value = props.apiKey || ''
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
  const path = window.api.file.pickFile({ location: true })
  if (path) {
    command.value = path as string
  }
  source.value = ''
}

const pickScript = () => {
  const path = window.api.file.pickFile({ location: true })
  if (path) {
    url.value = path as string
  }
}

const pickWorkDir = () => {
  const path = window.api.file.pickDirectory()
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
  if (variable.key.length) {
    let dict = getVarDict(variable.type)
    if (variable.key != selectedVar.value.key) {
      delete dict[selectedVar.value.key]
    }
    dict[variable.key] = variable.value
    dict = { ...dict }
  }
}

const checkOAuth = async (): Promise<void> => {
  if (await isOauthRequired()) {
    await initOauth(true)
  } else {
    Dialog.show({
      title: t('mcp.serverEditor.oauth.notRequired'),
    })
  }
}

const isOauthRequired = async (): Promise<boolean> => {
  if (type.value === 'smithery') return false
  return useMcpServer().isOauthRequired(type.value, url.value, headers.value, oauthConfig.value)
}

const initOauth = async (userInitiated: boolean): Promise<void> => {
  if (await useMcpServer().initOauth(userInitiated, url.value, headers.value, oauthStatus.value)) {
    await setupOAuth(userInitiated)
  }
}

const setupOAuth = async (userInitiated: boolean) => {
  const config = await useMcpServer().setupOAuth(url.value, oauthStatus.value, oauthClientId.value, oauthClientSecret.value)
  if (config) {
    oauthConfig.value = config    
    if (!userInitiated) {
      setTimeout(onSave, 500)
    }
  }
}

const removeOAuth = async () => {
  const result = await Dialog.show({
    title: t('mcp.serverEditor.oauth.removeConfirm'),
    text: t('mcp.serverEditor.oauth.removeConfirmText'),
    confirmButtonText: t('common.delete'),
    cancelButtonText: t('common.cancel'),
    showCancelButton: true
  })
  
  if (result.isConfirmed) {
    oauthConfig.value = null
  }
}

const onSave = async () => {

  if (type.value === 'stdio' && !command.value.length) {
    await Dialog.show({
      title: t('mcp.serverEditor.validation.requiredFields'),
      text: t('mcp.serverEditor.validation.commandRequired'),
      confirmButtonText: t('common.ok'),
    })
    return
  }

  if (type.value === 'sse' && !url.value.length) {
    await Dialog.show({
      title: t('mcp.serverEditor.validation.requiredFields'),
      text: t('mcp.serverEditor.validation.urlRequired'),
      confirmButtonText: t('common.ok'),
    })
    return
  }

  if (type.value === 'http' && !url.value.length) {
    await Dialog.show({
      title: t('mcp.serverEditor.validation.requiredFields'),
      text: t('mcp.serverEditor.validation.urlRequired'),
      confirmButtonText: t('common.ok'),
    })
    return
  }

  if (type.value === 'smithery' && !url.value.length) {
    await Dialog.show({
      title: t('mcp.serverEditor.validation.requiredFields'),
      text: t('mcp.serverEditor.validation.packageRequired'),
      confirmButtonText: t('common.ok'),
    })
    return
  }

  try {

    // Check if OAuth setup is needed before saving
    const oauthNeeded = await isOauthRequired()
    if (oauthNeeded) {
      loading.value = true
      initOauth(false)
      return
    }

    if (type.value === 'smithery') {

      loading.value = true
      if (await install(type.value, url.value, apiKey.value)) {
        emit('saved')
      }

    } else {

      // build a dummy server
      const server: McpServer = {
        uuid: props.server?.uuid,
        registryId: props.server?.registryId,
        state: props.server?.state || 'enabled',
        type: type.value,
        label: label.value.trim(),
        command: command.value,
        url: url.value,
        cwd: cwd.value,
        env: JSON.parse(JSON.stringify(env.value)),
        headers: JSON.parse(JSON.stringify(headers.value)),
        oauth: JSON.parse(JSON.stringify(oauthConfig.value)),
      }

      // save it
      loading.value = true
      await window.api.mcp.editServer(server)
      emit('saved')

    }

  } finally {
    loading.value = false
  }

}

const install = async (registry: string, server: string, apiKey: string): Promise<boolean> => {

  // save
  if (registry === 'smithery') {
    store.config.mcp.smitheryApiKey = apiKey
    store.saveSettings()
  }

  await nextTick()
  
  const rc: McpInstallStatus = await window.api.mcp.installServer(registry, server, apiKey)

  if (rc === 'success') {
    return true
  }

  if (rc === 'not_found') {
    await Dialog.show({
      title: t('mcp.failedToInstall'),
      text: t('mcp.serverNotFound'),
      confirmButtonText: t('common.retry'),
    })
    return false
  }

  if (rc === 'api_key_missing') {
    Dialog.show({
      title: t('mcp.failedToInstall'),
      text: t('mcp.retryWithApiKey'),
      confirmButtonText: t('common.retry'),
      denyButtonText: t('common.copy'),
      showCancelButton: true,
      showDenyButton: true,
    }).then((result) => {
      if (result.isDenied) {
        const command = window.api.mcp.getInstallCommand(registry, server)
        navigator.clipboard.writeText(command)
        emit('cancel')
      } else if (!result.isConfirmed) {
        emit('cancel')
      }
    })
    return false
  }
   
  // general error  
  Dialog.show({
    title: t('mcp.failedToInstall'),
    text: t('mcp.copyInstallCommand'),
    confirmButtonText: t('common.copy'),
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      const command = window.api.mcp.getInstallCommand(registry, server)
      navigator.clipboard.writeText(command)
    }
  })

}
</script>

<style scoped>

.mcp-server-editor {

  main {
    padding: 2rem 0rem;
    margin: 0 auto;
    width: 500px;
  }
  
  .list-with-actions {
    width: 100%;
  }

  .show-auth-fields {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
  }
}

</style>
