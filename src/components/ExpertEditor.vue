<template>
  <div class="expert-editor form form-vertical form-large" @keydown.enter="onSave">
    <div class="form-field" v-if="diffLang" style="margin-top: 16px; margin-bottom: 24px">
      <label class="no-colon"><BIconExclamationCircle /></label>
      <div>{{ t('common.differentLocales') }}</div>
    </div>
    <div class="form-field">
      <label>{{ t('common.name') }}</label>
      <input type="text" name="name" v-model="name" required @keyup="onChangeText" />
    </div>
    <div class="form-field">
      <label>{{ t('common.prompt') }}</label>
      <div class="form-subgroup">
        <textarea name="prompt" v-model="prompt" required @keyup="onChangeText"></textarea>
        <a href="#" name="reset" @click="onReset" v-if="isEdited">{{ t('commands.editor.resetToDefault') }}</a>
      </div>
    </div>
    <div class="form-field">
      <label>{{ t('common.llmProvider') }}</label>
      <EngineSelect v-model="engine" @change="onChangeEngine" :default-text="t('experts.editor.useDefault')" />
    </div>
    <div class="form-field">
      <label>{{ t('common.llmModel') }}</label>
      <ModelSelectPlus id="model" v-model="model" :engine="engine" :default-text="!models.length ? t('experts.editor.useDefault') : ''" />
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
          <button class="button add" @click.prevent="onAddApp"><BIconPlus /></button>
          <button class="button del" @click.prevent="onDelApp"><BIconDash /></button>
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

import { Expert, ExternalApp } from '../types/index'
import { FileContents } from '../types/file'
import { onMounted, ref, computed, watch } from 'vue'
import { store } from '../services/store'
import { expertI18n, expertI18nDefault, t } from '../services/i18n'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelectPlus from '../components/ModelSelectPlus.vue'
import Dialog from '../composables/dialog'

const emit = defineEmits(['expert-modified']);

const props = defineProps<{
  expert: Expert|null
}>()

const type = ref(null)
const name = ref(null)
const prompt = ref(null)
const engine = ref(null)
const model = ref(null)
const triggerApps = ref([])
const selectedApp = ref(null)
const diffLang = ref(false)
const isEdited = ref(false)

const icons: Record<string, FileContents> = {}

const supportTriggerApps = computed(() => window.api.platform !== 'linux')

const models = computed(() => {
  if (!engine.value || engine.value == '') return []
  return store.config.engines[engine.value].models.chat
})

const iconData = (app: ExternalApp) => {
  const icon = icons[app.identifier]
  return `data:${icon.mimeType};base64,${icon.contents}`
}

const onChangeText = () => {
  if (!props.expert) isEdited.value = false
  isEdited.value = ((props.expert?.type === 'system') && (name.value !== expertI18nDefault(props.expert, 'name') || prompt.value !== expertI18nDefault(props.expert, 'prompt')))
}

const onChangeEngine = () => {
  if (engine.value == '') model.value = ''
  else model.value = store.config.engines[engine.value].models.chat?.[0]?.id
}

onMounted(async () => {
  watch(() => props || {}, async () => {

    // update values
    type.value = props.expert?.type || 'user'
    name.value = props.expert?.name || expertI18n(props.expert, 'name')
    prompt.value = props.expert?.id ? (props.expert?.prompt || expertI18n(props.expert, 'prompt')) : ''
    engine.value = props.expert?.engine || ''
    model.value = props.expert?.model || ''
    triggerApps.value = JSON.parse(JSON.stringify(props.expert?.triggerApps || []))
    diffLang.value = window.api.config.localeUI() !== window.api.config.localeLLM()
    selectedApp.value = null
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
    prompt: prompt.value === expertI18nDefault(props.expert, 'prompt') ? undefined : prompt.value,
    ...(engine.value.length && model.value.length ? { engine: engine.value, model: model.value } : {}),
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