<template>
  <ModalDialog id="folder-settings" ref="dialog" type="window" @save="onSave" width="44rem">
    <template #header>
      {{ t('folderSettings.title') }}
    </template>
    <template #body>
      <div class="form form-vertical" @click="onDialogClick">
        <template v-if="!showAdvanced">

          <div class="form-field">
            <label>{{ t('common.llmModel') }}</label>
            <EngineModelSelect
              :engine="engine"
              :model="model"
              css-classes="folder-settings"
              @modelSelected="onModelSelected"
            />
          </div>
          
          <div class="form-field">
            <label>{{ t('modelSettings.instructions') }}</label>
            <textarea name="instructions" v-model="instructions" :placeholder="t('modelSettings.instructionsPlaceholder')" rows="4"></textarea>
          </div>
          
          <div class="form-field">
            <label>{{ t('modelSettings.plugins') }}</label>
            <div class="control-group">
              <select name="plugins" v-model="disableTools">
                <option :value="false">{{ t('common.enabled') }}</option>
                <option :value="true">{{ t('common.disabled') }}</option>
              </select>
              <button @click.prevent="onCustomizeTools" v-if="!disableTools">{{ t('common.customize') }}</button>
            </div>
            <template v-if="!disableTools">
              <div v-if="!areToolsDisabled(tools) && !areAllToolsEnabled(tools)">
                &nbsp;{{ t('modelSettings.toolsCount', { count: tools?.length || 0 }) }}
              </div>
              <div v-if="areAllToolsEnabled(tools)">
                &nbsp;{{ t('modelSettings.allToolsEnabled') }}
              </div>
            </template>
          </div>

          <div class="form-field">
            <label>{{ t('modelSettings.locale') }}</label>
            <LangSelect name="locale" v-model="locale" default-text="modelSettings.localeDefault" />
          </div>

          <div class="form-field">
            <label>{{ t('folderSettings.expert') }}</label>
            <select name="expert" v-model="expert">
              <option value="">{{ t('folderSettings.noExpert') }}</option>
              <option v-for="exp in enabledExperts" :key="exp.id" :value="exp.id">
                {{ exp.name || expertI18n(exp, 'name') }}
              </option>
            </select>
          </div>

          <div class="form-field">
            <label>{{ t('common.docRepos') }}</label>
            <button id="docrepos-menu-anchor" @click.prevent="showDocReposMenu = !showDocReposMenu">
              {{ getDocReposLabel() }}
            </button>
            <DocReposMenu
              v-if="showDocReposMenu"
              anchor="#docrepos-menu-anchor"
              position="below"
              :multi-select="true"
              :selected-doc-repos="docrepos"
              @close="showDocReposMenu = false"
              @doc-repos-changed="onDocReposChanged"
            />
          </div>

        </template>

        <template v-else>

          <div class="form-field" v-if="showAdvanced">
            <label>{{ t('modelSettings.streaming') }}</label>
            <select name="streaming" v-model="disableStreaming">
              <option :value="false">{{ t('common.enabled') }}</option>
              <option :value="true">{{ t('common.disabled') }}</option>
            </select>
          </div>

          <ModelAdvancedSettings
            v-model="modelOpts"
            :engine="engine"
            :model="model"
          />
        
        </template>

      </div>

    </template>

    <template #footer>
        <button name="save" @click="onSave" class="primary">{{ t('common.save') }}</button>
        <button name="advanced" @click="showAdvanced = !showAdvanced" class="secondary">
          {{ showAdvanced ? t('folderSettings.advancedSettings.hide') : t('folderSettings.advancedSettings.show') }}
        </button>
        <button name="cancel" @click="onCancel" class="tertiary" formnovalidate>{{ t('common.cancel') }}</button>
    </template>
  
  </ModalDialog>

  <ToolSelector ref="selector" @save="onSaveTools" />
</template>

<script setup lang="ts">
import { LlmModelOpts } from 'multi-llm-ts'
import { computed, onMounted, ref } from 'vue'
import DocReposMenu from '@components/DocReposMenu.vue'
import EngineModelSelect from '@components/EngineModelSelect.vue'
import LangSelect from '@components/LangSelect.vue'
import ModalDialog from '@components/ModalDialog.vue'
import ModelAdvancedSettings from '@components/ModelAdvancedSettings.vue'
import Dialog from '@renderer/utils/dialog'
import LlmFactory, { areAllToolsEnabled, areToolsDisabled, ILlmManager } from '@services/llms/llm'
import ToolSelector from '@screens/ToolSelector.vue'
import { expertI18n, t } from '@services/i18n'
import { store } from '@services/store'
import { Expert, Folder } from 'types/index'
import { ToolSelection } from 'types/llm'
import { DocumentBase } from 'types/rag'

const dialog = ref<InstanceType<typeof ModalDialog>>()
const selector = ref<InstanceType<typeof ToolSelector>>()
const llmManager: ILlmManager = LlmFactory.manager(store.config)
const folderId = ref<string | null>(null)

const engine = ref<string>('')
const model = ref<string>('')
const locale = ref<string>('')
const disableStreaming = ref<boolean>(false)
const disableTools = ref<boolean>(false)
const tools = ref<ToolSelection>(null)
const instructions = ref<string>('')
const expert = ref<string | null>(null)
const docrepos = ref<string[]>([])
const showAdvanced = ref(false)
const showDocReposMenu = ref(false)

const docRepos = ref<DocumentBase[]>([])
const enabledExperts = computed(() => {
  return store.experts.filter((exp: Expert) => exp.state === 'enabled')
})

const getDocReposLabel = (): string => {
  if (docrepos.value.length === 0) return t('folderSettings.noDocRepo')
  if (docrepos.value.length === 1) {
    const repo = docRepos.value.find(r => r.uuid === docrepos.value[0])
    return repo?.name || t('folderSettings.noDocRepo')
  }
  return t('agent.create.workflow.docReposCount', { count: docrepos.value.length })
}

const onDocReposChanged = (uuids: string[]) => {
  docrepos.value = uuids
}

const onDialogClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.docrepos-menu') && !target.closest('#docrepos-menu-anchor')) {
    showDocReposMenu.value = false
  }
}

// Computed property to bridge individual refs with LlmModelOpts for ModelAdvancedSettings
const modelOpts = ref<LlmModelOpts | undefined>(undefined)

onMounted(() => {
  loadDocRepos()
})

const loadDocRepos = () => {
  try {
    docRepos.value = window.api?.docrepo?.list(store.config.workspaceId) || []
  } catch (error) {
    console.error('Failed to load document repositories:', error)
    docRepos.value = []
  }
}

const show = (folder: Folder) => {

  folderId.value = folder.id
  showAdvanced.value = false

  // Load existing defaults or use sensible defaults
  if (folder.defaults) {
    const defaultEngineModel = llmManager.getChatEngineModel(false)
    engine.value = folder.defaults.engine || defaultEngineModel.engine
    model.value = folder.defaults.model || llmManager.getDefaultChatModel(engine.value, false)
    locale.value = folder.defaults.locale || ''
    disableStreaming.value = folder.defaults.disableStreaming || false
    disableTools.value = areToolsDisabled(folder.defaults.tools)
    tools.value = folder.defaults.tools || null
    instructions.value = folder.defaults.instructions || ''
    expert.value = folder.defaults.expert || null
    docrepos.value = folder.defaults.docrepos || []
    modelOpts.value = folder.defaults.modelOpts || undefined
  } else {
    // Use defaults
    const defaultEngineModel = llmManager.getChatEngineModel(false)
    engine.value = defaultEngineModel.engine
    model.value = defaultEngineModel.model
    locale.value = ''
    disableStreaming.value = false
    disableTools.value = false
    tools.value = null
    instructions.value = ''
    expert.value = null
    docrepos.value = []
    modelOpts.value = undefined
  }

  dialog.value?.show()
}

const close = () => {
  dialog.value?.close()
}

const onModelSelected = (newEngine: string | null, newModel: string | null) => {
  if (newEngine && newModel) {
    engine.value = newEngine
    model.value = newModel
  }
}

const onCustomizeTools = () => {
  selector.value?.show(tools.value)
}

const onSaveTools = (selected: ToolSelection) => {
  tools.value = selected
}

const onCancel = () => {
  close()
}

const onSave = () => {

  // Validate inputs
  if (!engine.value || !model.value) {
    Dialog.show({
      title: t('modelSettings.errors.noProviderOrModel.title'),
      text: t('modelSettings.errors.noProviderOrModel.text'),
      confirmButtonText: t('common.ok'),
    })
    return
  }

  // Find the folder and update defaults (modelOpts already formatted by ModelAdvancedSettings)
  const folder = store.history.folders.find((f) => f.id === folderId.value)
  if (folder) {
    folder.defaults = {
      engine: engine.value,
      model: model.value,
      disableStreaming: disableStreaming.value,
      tools: disableTools.value ? [] : tools.value,
      instructions: instructions.value.trim() || null,
      locale: locale.value.trim() || null,
      expert: expert.value,
      docrepos: docrepos.value.length ? docrepos.value : undefined,
      modelOpts: modelOpts.value && Object.keys(modelOpts.value).length > 0 ? modelOpts.value : null,
    }

    store.saveHistory()
    close()
  }
}

defineExpose({ show, close })
</script>

<style>

.context-menu.folder-settings {
  max-width: unset;
  width: 39.5rem;
  border-radius: 0rem;
}

</style>

<style scoped>

.engine-model-select {
  width: calc(100% - 2rem);
}

</style>


