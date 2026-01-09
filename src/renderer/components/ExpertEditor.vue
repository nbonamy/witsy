<template>
  <div class="expert-editor form form-vertical form-large" @keydown.enter="onSave" @click="onEditorClick">
    <div class="form-field" v-if="diffLang" style="margin-top: 16px; margin-bottom: 24px">
      <label class="no-colon"><CircleAlertIcon /></label>
      <div>{{ t('common.differentLocales') }}</div>
    </div>
    <div class="form-field">
      <label>{{ t('common.name') }}</label>
      <input type="text" name="name" v-model="name" required @keyup="onChangeText" />
    </div>
    <!-- <div class="form-field">
      <label>{{ t('common.description') }}</label>
      <textarea name="description" v-model="description" rows="2" :placeholder="t('settings.experts.descriptionPlaceholder')"></textarea>
    </div> -->
    <div class="form-field">
      <label>{{ t('common.prompt') }}</label>
      <div class="form-subgroup">
        <textarea name="prompt" v-model="prompt" required @keyup="onChangeText"></textarea>
        <a href="#" name="reset" @click="onReset" v-if="isEdited">{{ t('commands.editor.resetToDefault') }}</a>
      </div>
    </div>
    <div class="form-field">
      <label>{{ t('common.category') }}</label>
      <select v-model="categoryId">
        <option value="">{{ t('settings.experts.noCategory') }}</option>
        <option v-for="cat in allCategories" :key="cat.id" :value="cat.id">
          {{ cat.name }}
        </option>
      </select>
    </div>
    <div class="form-field">
      <label>{{ t('common.llmProvider') }}</label>
      <EngineModelSelect :engine="engine" :model="model" :default-label="t('experts.editor.useDefault')" @model-selected="onModelSelected" />
    </div>
    <div class="form-field">
      <label>{{ t('common.docRepos') }}</label>
      <button id="expert-docrepos-menu-anchor" @click.prevent="showDocReposMenu = !showDocReposMenu">
        {{ getDocReposLabel() }}
      </button>
      <DocReposMenu
        v-if="showDocReposMenu"
        anchor="#expert-docrepos-menu-anchor"
        position="below"
        :multi-select="true"
        :selected-doc-repos="docrepos"
        @close="showDocReposMenu = false"
        @doc-repos-changed="onDocReposChanged"
      />
    </div>
    <div class="form-field" v-if="supportTriggerApps">
      <label>{{ t('experts.editor.triggerApps') }}</label>
      <div class="form-subgroup list-with-actions">
        <div class="lwa-list">
          <template v-for="app in triggerApps" :key="app.identifier">
          <div :class="{ item: true, selected: app.identifier == selectedApp?.identifier }" @click="selectApp(app)">
            <img class="icon" :src="iconData(app)" v-if="icons[app.identifier]" />
            <div class="name">{{ app.name }}</div>
          </div>
        </template>
        </div>
        <div class="lwa-actions">
          <button class="button add" @click.prevent="onAddApp"><PlusIcon /></button>
          <button class="button del" @click.prevent="onDelApp"><MinusIcon /></button>
        </div>
        <span> {{ t('experts.editor.triggerAppsDescription') }}</span>
      </div>
    </div>
    <div class="buttons">
      <button type="button" @click="onCancel" formnovalidate>{{ t('common.cancel') }}</button>
      <button type="button" @click="onSave" class="default">{{ t('common.save') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">

import { CircleAlertIcon, MinusIcon, PlusIcon } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import DocReposMenu from '@components/DocReposMenu.vue'
import Dialog from '@renderer/utils/dialog'
import { expertI18n, expertI18nDefault, categoryI18n, t } from '@services/i18n'
import { store } from '@services/store'
import { FileContents } from 'types/file'
import { Expert, ExpertCategory, ExternalApp } from 'types/index'
import { DocumentBase } from 'types/rag'
import EngineModelSelect from './EngineModelSelect.vue'

const emit = defineEmits(['expert-modified']);

const props = defineProps<{
  expert: Expert|null
}>()

const type = ref(null)
const name = ref(null)
const description = ref(null)
const categoryId = ref<string>('')
const prompt = ref(null)
const engine = ref(null)
const model = ref(null)
const docrepos = ref<string[]>([])
const docRepos = ref<DocumentBase[]>([])
const showDocReposMenu = ref(false)
const triggerApps = ref([])
const selectedApp = ref(null)
const diffLang = ref(false)
const isEdited = ref(false)

const allCategories = computed(() => store.expertCategories.filter(c => c.state === 'enabled').map((c: ExpertCategory) => ({
    id: c.id,
    name: categoryI18n(c, 'name')
  })).sort((a, b) => a.name.localeCompare(b.name))
)

const icons: Record<string, FileContents> = {}

const supportTriggerApps = computed(() => window.api.platform !== 'linux')

const iconData = (app: ExternalApp) => {
  const icon = icons[app.identifier]
  return `data:${icon.mimeType};base64,${icon.contents}`
}

const loadDocRepos = () => {
  try {
    docRepos.value = window.api?.docrepo?.list(store.config.workspaceId) || []
  } catch (error) {
    console.error('Failed to load document repositories:', error)
    docRepos.value = []
  }
}

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

const onEditorClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.docrepos-menu') && !target.closest('#expert-docrepos-menu-anchor')) {
    showDocReposMenu.value = false
  }
}

const onChangeText = () => {
  if (!props.expert) isEdited.value = false
  isEdited.value = ((props.expert?.type === 'system') && (name.value !== expertI18nDefault(props.expert, 'name') || prompt.value !== expertI18nDefault(props.expert, 'prompt')))
}

const onModelSelected = (e: string, m: string) => {
  model.value = m
  engine.value = e
}

onMounted(async () => {
  loadDocRepos()
  watch(() => props || {}, async () => {

    // update values
    type.value = props.expert?.type || 'user'
    categoryId.value = props.expert?.categoryId || ''
    name.value = props.expert?.name || expertI18n(props.expert, 'name')
    description.value = props.expert?.id ? (props.expert?.description ?? expertI18n(props.expert, 'description')) : ''
    prompt.value = props.expert?.id ? (props.expert?.prompt || expertI18n(props.expert, 'prompt')) : ''
    engine.value = props.expert?.engine || ''
    model.value = props.expert?.model || ''
    docrepos.value = props.expert?.docrepos || []
    triggerApps.value = JSON.parse(JSON.stringify(props.expert?.triggerApps || []))
    diffLang.value = window.api.config.localeUI() !== window.api.config.localeLLM()
    selectedApp.value = null
    showDocReposMenu.value = false
    onChangeText()

    // load icons
    for (const app of triggerApps.value) {
      if (app.icon.contents) {
        icons[app.identifier] = app.icon
      } else {
        icons[app.identifier] = window.api.file.readIcon(app.icon)
      }
    }

  }, { deep: true, immediate: true })

})

const selectApp = (app: ExternalApp) => {
  selectedApp.value = app
}

const onAddApp = () => {
  const app = window.api.file.pickFile({ packages: true, location: true })
  const info = window.api.file.getAppInfo(app as string)
  if (!info) {
    Dialog.alert(t('experts.editor.validation.invalidApp'))
    return
  }
  icons[info.identifier] = info.icon
  triggerApps.value.push(info)
}

const onDelApp = () => {
  triggerApps.value = triggerApps.value.filter((app: ExternalApp) => app.identifier != selectedApp.value.identifier)
  selectedApp.value = null
}

const close = () => {
  emit('expert-modified')
}

const onCancel = () => {
  close()
}

const onReset = () => {
  name.value = expertI18nDefault(props.expert, 'name')
  prompt.value = expertI18nDefault(props.expert, 'prompt')
  isEdited.value = false
}

const onSave = (event: Event) => {

  // not in textarea
  if ((event.target as HTMLElement).nodeName.toLocaleLowerCase() === 'textarea') {
    return
  }

  // check
  if (!name.value || !prompt.value) {
    event.preventDefault()
    Dialog.alert(t('experts.editor.validation.requiredFields'))
    return
  }

  // save it
  emit('expert-modified', {
    id: props.expert.id,
    name: name.value === expertI18nDefault(props.expert, 'name') ? undefined : name.value,
    description: description.value === expertI18nDefault(props.expert, 'description') ? undefined : description.value,
    categoryId: categoryId.value || undefined,
    prompt: prompt.value === expertI18nDefault(props.expert, 'prompt') ? undefined : prompt.value,
    ...(engine.value?.length && model.value?.length ? { engine: engine.value, model: model.value } : {}),
    docrepos: docrepos.value.length ? docrepos.value : undefined,
    triggerApps: triggerApps.value.map((app) => {
      if (app.icon.contents) {
        app.icon = app.icon.url.replace('file://', '')
      }
      return app
    })
  })
}

</script>

<style scoped>

.expert-editor {

  textarea {
    height: 120px;
    resize: vertical !important;
  }

  .engine-model-select {
    width: calc(100% - 2rem);
  }

  .list-with-actions {

    .lwa-list {

      height: 100px;
      overflow-y: auto;

      .item {

        display: flex;
        flex-direction: row;
        align-items: center;
        align-self: stretch;
        padding: 4px 8px;

        .icon {
          height: 24px;
          width: 24px;
          margin-right: 8px;
        }

        &.selected {
          background-color: var(--highlight-color);
          color: var(--highlighted-color);
        }
      }
    }
  }

}

.windows .expert-editor .list-with-actions .lwa-list .item .icon {
  transform: scale(0.8);
}

</style>