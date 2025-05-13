<template>
  <ModalDialog id="expert-editor" ref="dialog" :editor="true">
    <template #header>
      <div class="title">{{ t('experts.editor.title') }}</div>
    </template>
    <template #body>
      <div class="group" v-if="diffLang" style="margin-top: 16px; margin-bottom: 24px">
        <label class="no-colon"><BIconExclamationCircle /></label>
        <div>{{ t('common.differentLocales') }}</div>
      </div>
      <div class="group">
        <label>{{ t('common.name') }}</label>
        <input type="text" name="name" v-model="name" required @keyup="onChangeText" />
      </div>
      <div class="group">
        <label>{{ t('common.prompt') }}</label>
        <div class="subgroup">
          <textarea name="prompt" v-model="prompt" required @keyup="onChangeText"></textarea>
          <a href="#" name="reset" @click="onReset" v-if="isEdited">{{ t('commands.editor.resetToDefault') }}</a>
        </div>
      </div>
      <div class="group" v-if="supportTriggerApps">
        <label>{{ t('experts.editor.triggerApps') }}</label>
        <div class="subgroup list-with-actions">
          <div class="list">
            <template v-for="app in triggerApps" :key="app.identifier">
            <div :class="{ item: true, selected: app.identifier == selectedApp?.identifier }" @click="selectApp(app)">
              <img class="icon" :src="iconData(app)" />
              <div class="name">{{ app.name }}</div>
            </div>
          </template>
          </div>
          <div class="actions">
            <button class="button add" @click.prevent="onAddApp"><BIconPlus /></button>
            <button class="button del" @click.prevent="onDelApp"><BIconDash /></button>
          </div>
          <span> {{ t('experts.editor.triggerAppsDescription') }}</span>
        </div>
      </div>
    </template>
    <template #footer>
      <button type="button" @click="onSave" class="default">{{ t('common.save') }}</button>
      <button type="button" @click="onCancel" formnovalidate>{{ t('common.cancel') }}</button>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">

import { Expert, ExternalApp, FileContents } from '../types/index'
import { ref, computed, watch } from 'vue'
import { expertI18n, t } from '../services/i18n'
import ModalDialog from '../components/ModalDialog.vue'
import Dialog from '../composables/dialog'

const emit = defineEmits(['expert-modified']);

const props = defineProps<{
  expert: Expert|null
}>()

const dialog = ref(null)
const type = ref(null)
const name = ref(null)
const prompt = ref(null)
const triggerApps = ref([])
const selectedApp = ref(null)
const diffLang = ref(false)
const isEdited = ref(false)

const icons: Record<string, FileContents> = {}

const supportTriggerApps = computed(() => window.api.platform !== 'linux')

const iconData = (app: ExternalApp) => {
  const icon = icons[app.identifier]
  return `data:${icon.mimeType};base64,${icon.contents}`
}

const onChangeText = () => {
  if (!props.expert) isEdited.value = false
  isEdited.value = ((props.expert?.type === 'system') && (name.value !== expertI18n(props.expert, 'name') || prompt.value !== expertI18n(props.expert, 'prompt')))
}

const load = () => {

  // load expert
  type.value = props.expert?.type || 'user'
  name.value = props.expert?.name || expertI18n(props.expert, 'name')
  prompt.value = props.expert?.prompt || expertI18n(props.expert, 'prompt')
  triggerApps.value = props.expert?.triggerApps || []
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
}

const selectApp = (app: ExternalApp) => {
  selectedApp.value = app
}

const onAddApp = () => {
  const app = window.api.file.pick({ packages: true, location: true })
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

// not really sure this is how it supposed to be done
// but at least it works!
watch(() => props.expert || {}, load, { immediate: true })

const close = () => {
  emit('expert-modified')
  document.querySelector<HTMLDialogElement>('#expert-editor').close()
}

const onCancel = () => {
  close()
}

const onReset = () => {
  name.value = expertI18n(props.expert, 'name')
  prompt.value = expertI18n(props.expert, 'prompt')
  isEdited.value = false
}

const onSave = (event: Event) => {

  // check
  if (!name.value || !prompt.value) {
    event.preventDefault()
    Dialog.alert(t('experts.editor.validation.requiredFields'))
    return
  }

  // save it
  emit('expert-modified', {
    id: props.expert.id,
    name: name.value === expertI18n(props.expert, 'name') ? undefined : name.value,
    prompt: prompt.value === expertI18n(props.expert, 'prompt') ? undefined : prompt.value,
    triggerApps: triggerApps.value.map((app) => {
      if (app.icon.contents) {
        app.icon = app.icon.url.replace('file://', '')
      }
      return app
    })
  })
}

defineExpose({
  show: () => dialog.value.show('#expert-editor'),
  close,
})

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/editor.css';
@import '../../css/list-with-actions.css';
</style>

<style scoped>

dialog.editor form .group input.icon {
  flex: 0 0 32px;
  text-align: center;
}

dialog.editor form .group input.shortcut {
  flex: 0 0 32px;
  text-align: center;
  text-transform: uppercase;
}

.windows dialog.editor .icon {
  font-family: 'NotoColorEmojiLimited';
  font-size: 9pt;
}

.list-with-actions {

  .list {

    height: 80px;
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

.windows .list-with-actions .list .item .icon {
  transform: scale(0.8);
}

</style>