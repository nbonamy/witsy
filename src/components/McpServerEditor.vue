<template>
  <div class="mcp-server-editor form form-vertical form-large" @keydown.enter.prevent="onSave">
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
      <button name="cancel" @click.prevent="onCancel" class="alert-neutral" formnovalidate>{{ t('common.cancel') }}</button>
      <button name="save" @click.prevent="onSave" class="alert-confirm">{{ type === 'smithery' ? t('common.install') : t('common.save') }}</button>
    </div>
  </div>
  <VariableEditor ref="editor" id="mcp-variable-editor" title="mcp.variableEditor.title" :variable="selectedVar" @save="onSaveVar" />
</template>

<script setup lang="ts">

import { onMounted, PropType, ref, watch } from 'vue'
import VariableTable from '../components/VariableTable.vue'
import Dialog from '../composables/dialog'
import VariableEditor from '../screens/VariableEditor.vue'
import { t } from '../services/i18n'
import { strDict } from '../types/index'
import { McpServer, McpServerType } from '../types/mcp'

export type McpCreateType = McpServerType | 'smithery'

export type McpServerVariableType = 'env' | 'header'

export type McpServerVariable = {
  type: McpServerVariableType
  key: string
  value: string
}

const editor = ref(null)
const type = ref('stdio')
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
  // Initialize values from props
  const initializeValues = async () => {
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
  }

  // Initialize immediately
  await initializeValues()

  // Watch for specific prop changes without deep watching the entire props object
  watch(() => props.server, initializeValues)
  watch(() => props.type, initializeValues)
  watch(() => props.apiKey, initializeValues)

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
    await initOauth(false)
  } else {
    Dialog.show({
      title: t('mcp.serverEditor.oauth.notRequired'),
    })
  }
}

const isOauthRequired = async (): Promise<boolean> => {

  if (type.value !== 'http' || !url.value || oauthConfig.value) {
    return false
  }

  try {
    const oauthCheck = await window.api.mcp.detectOAuth(url.value)
    return oauthCheck.requiresOAuth
  } catch {
    return false
  }

}

const initOauth = async (confirmWithUser: boolean): Promise<boolean> => {

  try {
    const oauthCheck = await window.api.mcp.detectOAuth(url.value)
    if (!oauthCheck.requiresOAuth) {
      return true
    }

    // Update OAuth status for UI
    oauthStatus.value.required = true
    oauthStatus.value.metadata = oauthCheck.metadata
    oauthStatus.value.checked = true

    // ask if required
    let result = { isConfirmed: true }
    if (confirmWithUser) {
      result = await Dialog.show({
        title: t('mcp.serverEditor.oauth.required'),
        text: t('mcp.serverEditor.oauth.requiredText'),
        confirmButtonText: t('common.yes'),
        cancelButtonText: t('common.cancel'),
        showCancelButton: true
      })
    }

    if (result.isConfirmed) {
      await setupOAuth()
      return true
    } else {
      return false
    }
  
  } catch (error) {
    console.error('Failed to detect OAuth requirement during save:', error)
    return true
  }
}

const setupOAuth = async () => {
  
  if (!oauthStatus.value.metadata) {
    console.error('No OAuth metadata available')
    return
  }

  try {
    // Show loading state
    await Dialog.show({
      title: t('mcp.serverEditor.oauth.authorizing'),
      text: t('mcp.serverEditor.oauth.authorizingText'),
      confirmButtonText: t('common.ok'),
    })

    // Start OAuth flow with optional client credentials
    const clientCredentials = (oauthClientId.value || oauthClientSecret.value) ? {
      client_id: oauthClientId.value,
      client_secret: oauthClientSecret.value
    } : undefined
    
    const oauthResult = await window.api.mcp.startOAuthFlow(
      url.value, 
      JSON.parse(JSON.stringify(oauthStatus.value.metadata)),
      clientCredentials
    )
    
    // Parse the returned OAuth configuration and set up local config
    const oauthData = JSON.parse(oauthResult)
    oauthConfig.value = {
      // Only store essential OAuth data in compact form
      tokens: oauthData.tokens,
      clientId: oauthData.clientInformation?.client_id,
      clientSecret: oauthData.clientInformation?.client_secret
      // clientMetadata is standardized and regenerated each time
    }

    await Dialog.show({
      title: t('mcp.serverEditor.oauth.success'),
      text: t('mcp.serverEditor.oauth.successText'),
      confirmButtonText: t('common.ok'),
    })
    
  } catch (error) {
    console.error('OAuth setup failed:', error)
    await Dialog.show({
      title: t('mcp.serverEditor.oauth.error'),
      text: error.message || t('mcp.serverEditor.oauth.errorText'),
      confirmButtonText: t('common.ok'),
    })
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

  // Check if OAuth setup is needed before saving
  const oauthNeeded = await isOauthRequired()
  if (oauthNeeded) {
    initOauth(true)
    return
  }

  if (type.value === 'smithery') {

    emit('install', {
      registry: type.value,
      server: url.value,
      apiKey: apiKey.value,
    })

  } else {

    const trimmedLabel = label.value.trim()

    const payload: any = {
      type: type.value,
      label: label.value.trim(),
      command: command.value,
      url: url.value,
      cwd: cwd.value,
      env: JSON.parse(JSON.stringify(env.value)),
      headers: JSON.parse(JSON.stringify(headers.value)),
      oauth: JSON.parse(JSON.stringify(oauthConfig.value)),
    }

    // include label only when non-empty or when it existed before (allows deletion)
    if (trimmedLabel.length || props.server?.label !== undefined) {
      payload.label = trimmedLabel
    }

    emit('save', payload)

  }

}

</script>

<style scoped>

.mcp-server-editor {
  
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
