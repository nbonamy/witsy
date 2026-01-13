<template>
  <ModalDialog
    ref="dialog"
    id="mcp-tool-tester"
    :width="'48rem'"
    :height="'40rem'"
    :dismissible="true"
    type="window"
    form="vertical"
  >
    <template #header>
      <div class="title">{{ t('mcp.toolTester.title', { name: server ? server?.label : '' }) }}</div>
    </template>

    <template #body>
      <div class="mcp-tool-tester-body">

        <!-- Tool Selector -->
        <div class="form-field">
          <label for="tool-select">{{ t('mcp.toolTester.selectTool') }}</label>
          <select id="tool-select" v-model="selectedToolName" @change="onToolChange">
            <option v-for="tool in tools" :key="tool.function" :value="tool.function">
              {{ tool.name }}
            </option>
          </select>
          <div v-if="selectedTool && !hasResult" class="tool-description">
            {{ selectedTool.description }}
          </div>
        </div>

        <!-- Dynamic Parameter Form -->
        <div v-if="selectedTool && selectedTool.inputSchema?.properties && !hasResult" class="parameters-form">
          <h3>{{ t('mcp.toolTester.parameters') }}</h3>
          <div class="form form-vertical">
            <div
              v-for="param in sortedParameters"
              :key="param.name"
              class="form-field"
            >
              <label :for="`param-${param.name}`">
                {{ param.name }}
                <span v-if="isRequired(param.name)" class="required">*</span>
                <span v-if="param.schema.description" class="field-description">
                  - {{ param.schema.description }}
                </span>
              </label>

              <!-- String input -->
              <input
                v-if="param.schema.type === 'string'"
                :id="`param-${param.name}`"
                type="text"
                v-model="parameters[param.name]"
              />

              <!-- Number input -->
              <input
                v-else-if="param.schema.type === 'number' || param.schema.type === 'integer'"
                :id="`param-${param.name}`"
                type="number"
                v-model.number="parameters[param.name]"
              />

              <!-- Boolean checkbox -->
              <div v-else-if="param.schema.type === 'boolean'" class="checkbox-wrapper">
                <input
                  :id="`param-${param.name}`"
                  type="checkbox"
                  v-model="parameters[param.name]"
                />
                <label :for="`param-${param.name}`">{{ t('common.enabled') }}</label>
              </div>

              <!-- Unsupported complex types -->
              <div v-else class="unsupported-type">
                {{ t('mcp.toolTester.complexTypeNotSupported') }} ({{ param.schema.type }})
              </div>
            </div>
          </div>
        </div>

        <!-- No Parameters Message -->
        <div v-if="selectedTool && !selectedTool.inputSchema?.properties && !hasResult" class="no-parameters">
          {{ t('mcp.toolTester.noParameters') }}
        </div>

        <!-- Result Display -->
        <div v-if="hasResult" class="result-section">
          <h3>{{ t('mcp.toolTester.result') }}</h3>

          <!-- Loading State -->
          <div v-if="executing" class="executing-message">
            <Loader />
            <Loader />
            <Loader />
          </div>

          <!-- Error Display -->
          <div v-else-if="error" class="error-message">
            <strong>{{ t('common.error') }}:</strong> {{ error }}
          </div>

          <!-- Success Display -->
          <div v-else-if="result !== null" class="result-display">
            <!-- JSON Result -->
            <div v-if="isJsonResult" class="json-result">
              <JsonViewer
                :value="result"
                :expand-depth="2"
                :copyable="copyable"
                sort
                theme="jv-dark"
                :expanded="false"
              />
            </div>
            <!-- Plain Text Result -->
            <pre v-else class="text-result">{{ result }}</pre>
          </div>
        </div>
      </div>
    </template>

    <template #footer>

      <template v-if="!hasResult">
        <button class="primary" @click="onExecute" :disabled="!selectedToolName || executing">
          {{ executing ? t('mcp.toolTester.executing') : t('mcp.toolTester.execute') }}
        </button>
        <button class="secondary" @click="onClear" :disabled="!selectedToolName">
          {{ t('mcp.toolTester.clear') }}
        </button>
      </template>

      <template v-else-if="!executing">
        <button class="primary" @click="onTryAgain">
          {{ t('mcp.toolTester.tryAgain') }}
        </button>
      </template>

      <button class="tertiary" @click="onClose">
        {{ t('common.close') }}
      </button>

    </template>
  </ModalDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { JsonViewer } from 'vue3-json-viewer'
import { McpServer, McpTool } from 'types/mcp'
import { t } from '@services/i18n'
import ModalDialog from './ModalDialog.vue'
import Loader from './Loader.vue'

const dialog = ref<InstanceType<typeof ModalDialog>>()
const server = ref<McpServer>()
const tools = ref<McpTool[]>([])
const selectedToolName = ref('')
const parameters = ref<Record<string, any>>({})
const executing = ref(false)
const result = ref<any>(null)
const error = ref<string | null>(null)
const copyable = ref({ copyText: t('common.copy'), copiedText: t('common.copied'), timeout: 1000 })

const selectedTool = computed(() => {
  return tools.value.find(tool => tool.function === selectedToolName.value) || null
})

const sortedParameters = computed(() => {
  if (!selectedTool.value?.inputSchema?.properties) return []

  const properties = selectedTool.value.inputSchema.properties
  const required = selectedTool.value.inputSchema.required || []

  return Object.entries(properties).map(([name, schema]) => ({
    name,
    schema,
    isRequired: required.includes(name)
  })).sort((a, b) => {
    // Required parameters first
    if (a.isRequired && !b.isRequired) return -1
    if (!a.isRequired && b.isRequired) return 1
    // Then alphabetically
    return a.name.localeCompare(b.name)
  })
})

const hasResult = computed(() => {
  return executing.value || error.value !== null || result.value !== null
})

const isJsonResult = computed(() => {
  return result.value !== null && typeof result.value === 'object'
})

const isRequired = (propName: string): boolean => {
  return selectedTool.value?.inputSchema?.required?.includes(propName) || false
}

const onToolChange = () => {
  // Reset parameters when tool changes
  parameters.value = {}
  result.value = null
  error.value = null
}

const onClose = () => {
  dialog.value?.close()
}

const onClear = () => {
  parameters.value = {}
  result.value = null
  error.value = null
}

const onTryAgain = () => {
  result.value = null
  error.value = null
  executing.value = false
}

const onExecute = async () => {
  if (!selectedToolName.value) return
  executing.value = true
  error.value = null
  result.value = null

  try {
    // Filter out empty string values and convert to proper types
    const cleanParams: Record<string, any> = {}
    for (const [key, value] of Object.entries(parameters.value)) {
      if (value !== '' && value !== null && value !== undefined) {
        cleanParams[key] = value
      }
    }

    const toolResult = await window.api.mcp.callTool(selectedToolName.value, cleanParams)
    result.value = toolResult

  } catch (err: any) {
    error.value = err.message || String(err)
  } finally {
    executing.value = false
  }
}

const show = async (srv: McpServer) => {

  server.value = srv
  tools.value = await window.api.mcp.getServerTools(server.value.uuid)
  selectedToolName.value = tools.value[0]?.function || ''
  parameters.value = {}
  result.value = null
  error.value = null
  executing.value = false
  dialog.value?.show()
}

const close = () => {
  dialog.value?.close()
}

defineExpose({ show, close })
</script>

<style>

#mcp-tool-tester {
  .modal-body {
    justify-content: flex-start;
  }
}

</style>

<style scoped>

.mcp-tool-tester-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}


.tool-description {
  margin-top: 0.5rem;
  color: var(--faded-text-color);
}

.parameters-form h3,
.result-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0rem;
  color: var(--text-color);
}

.form-field {
  margin: 0.25rem 0rem;
}

.field-description {
  font-weight: normal;
  color: var(--faded-text-color);
  font-size: 0.85rem;
}

.required {
  color: var(--color-error);
  font-weight: bold;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-wrapper input[type="checkbox"] {
  width: auto;
  margin: 0;
}

.checkbox-wrapper label {
  margin: 0;
  font-weight: normal;
}

.unsupported-type {
  padding: 0.5rem;
  background-color: var(--background-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--faded-text-color);
  font-size: 0.85rem;
  font-style: italic;
}

.no-parameters {
  padding: 1rem;
  text-align: center;
  color: var(--faded-text-color);
  font-style: italic;
}

.result-section {
  padding-top: 1rem;
}

.executing-message {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  padding: 4rem 1rem;
  text-align: center;
}

.error-message {
  padding: 1rem;
  background-color: var(--color-error-container);
  border: 1px solid var(--color-error);
  border-radius: 4px;
  color: var(--color-error);
}

.result-display {
  max-height: 500px;
  overflow-y: auto;
}

.json-result {
  margin-bottom: 1rem;
  background-color: rgb(13,13,13);
  border-radius: 8px;
  color: white;
}

.json-result:deep() span,
.json-result:deep() a {
  font-family: SF Mono, Monaco, Andale Mono, Ubuntu Mono, monospace !important;
  font-size: 14px;
}

.json-result:deep() .jv-code {
  padding: 12px;
  white-space: pre-wrap;
}

.json-result:deep() .jv-ellipsis {
  cursor: pointer;
}

.json-result:deep() .jv-toggle {
  background: none;
}

.json-result:deep() .jv-toggle::before {
  color: var(--link-color);
  content: '⏵';
}

.json-result:deep() .jv-toggle.open {
  position: relative;
  top: 4px;
  left: 2px;
}

.text-result {
  position: relative;
  white-space: pre-wrap;
  word-break: break-all;
  background-color: rgb(13,13,13);
  color: #fff;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  font-family: SF Mono, Monaco, Andale Mono, Ubuntu Mono, monospace !important;
  margin: 0;
}
</style>
