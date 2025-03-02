<template>
  <dialog id="command-editor" class="editor">
    <form method="dialog">
      <header>
        <div class="title">{{ t('commands.editor.title') }}</div>
      </header>
      <main>
        <div class="group" v-if="diffLang" style="margin-top: 16px; margin-bottom: 24px">
          <label class="no-colon"><BIconExclamationCircle /></label>
          <div>{{ t('common.differentLocales') }}</div>
        </div>
        <div class="group">
          <label>{{ t('common.name') }}</label>
          <input type="text" name="label" v-model="label" @keyup="onChangeText" required />
        </div>
        <div class="group">
          <label>{{ t('commands.editor.prompt') }}</label>
          <div class="subgroup">
            <textarea name="template" v-model="template" required @keyup="onChangeText" v-if="isEditable"></textarea>
            <textarea name="template" disabled="true" v-else>{{ t('commands.editor.notEditable') }}</textarea>
            <span>{{ t('commands.editor.inputPlaceholder') }}</span>
            <a href="#" name="reset" @click="onReset" v-if="isEdited">{{ t('commands.editor.resetToDefault') }}</a>
          </div>
        </div>
        <div class="group">
          <label>{{ t('common.llmProvider') }}</label>
          <EngineSelect v-model="engine" @change="onChangeEngine" :default-text="t('commands.editor.useDefault')" />
        </div>
        <div class="group">
          <label>{{ t('common.llmModel') }}</label>
          <ModelSelect v-model="model" :engine="engine" :default-text="!models.length ? t('commands.editor.useDefault') : ''" />
        </div>
        <div class="group">
          <label>{{ t('common.icon') }}</label>
          <!-- maxlength=1 prevents emojis to be "pasted" from mac system window -->
          <input type="text" name="icon" v-model="icon" class="icon" @keydown="onIconKeyDown" @keyup="onIconKeyUp"/>
        </div>
        <div class="group">
          <label>{{ t('common.shortcut') }}</label>
          <input type="text" name="shortcut" v-model="shortcut" class="shortcut" maxlength="1" @keydown="onShortcutKeyDown" @keyup="onShortcutKeyUp" />
        </div>
      </main>
      <footer>
        <button type="button" @click="onSave" class="default">{{ t('common.save') }}</button>
        <button type="button" @click="onCancel" formnovalidate>{{ t('common.cancel') }}</button>
      </footer>
    </form>
  </dialog>
</template>

<script setup lang="ts">

import { ref, computed, watch, PropType } from 'vue'
import { Command } from '../types/index'
import { store } from '../services/store'
import { t, commandI18n } from '../services/i18n'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import Dialog from '../composables/dialog'
import { BIconExclamationCircle } from 'bootstrap-icons-vue'

const emit = defineEmits(['command-modified']);

const props = defineProps({
  command: Object as PropType<Command>,
})

const icon = ref(null)
const label = ref(null)
const template = ref(null)
const diffLang = ref(false)
const isEdited = ref(false)
const action = ref(null)
const shortcut = ref(null)
const engine = ref(null)
const model = ref(null)

const models = computed(() => {
  if (!engine.value || engine.value == '') return []
  return store.config.engines[engine.value].models.chat
})

const isEditable = computed(() => {
  return window.api.commands.isPromptEditable(props.command?.id)
})

const onChangeText = () => {
  if (!props.command) isEdited.value = false
  isEdited.value = ((props.command?.type === 'system') && (label.value !== commandI18n(props.command, 'label') || template.value !== commandI18n(props.command, 'template')))
}

const load = () => {
  icon.value = props.command?.icon || '⚡️'
  label.value = props.command?.label || commandI18n(props.command, 'label')
  template.value = props.command?.template || commandI18n(props.command, 'template')
  action.value = props.command?.action || 'chat_window'
  shortcut.value = props.command?.shortcut
  engine.value = props.command?.engine
  model.value = props.command?.model
  diffLang.value = window.api.config.localeUI() !== window.api.config.localeLLM()
  onChangeText()
}

// not really sure this is how it supposed to be done
// but at least it works!
watch(() => props.command || {}, load, { immediate: true })

const onChangeEngine = () => {
  if (engine.value == '') model.value = ''
  else model.value = store.config.engines[engine.value].models.chat?.[0]?.id
}

const onIconKeyDown = (event: KeyboardEvent) => {
  if (icon.value?.length) {
    if (event.key !== 'Backspace' && event.key !== 'Delete') {
      event.preventDefault()
    }
  }
}
const onIconKeyUp = () => {
  if (icon.value?.length > 1) {
    icon.value = icon.value.trim()[0]
  }
}

const onShortcutKeyDown = () => {
  shortcut.value = ''
}

const onShortcutKeyUp = (event: KeyboardEvent) => {

  // must be a normal character
  if (event.keyCode < 32) {
    return
  }

  shortcut.value = event.key.toUpperCase()

}

const close = () => {
  document.querySelector<HTMLDialogElement>('#command-editor').close()
}

const onCancel = () => {
  emit('command-modified')
  close()
}

const onReset = () => {
  label.value = commandI18n(props.command, 'label')
  template.value = commandI18n(props.command, 'template')
  isEdited.value = false
}

const onSave = (event: Event) => {

  // check
  if (!label.value || !template.value || !action.value) {
    event.preventDefault()
    Dialog.alert(t('commands.editor.validation.requiredFields'))
    return
  }

  // check
  if (!template.value.includes('{input}')) {
    event.preventDefault()
    Dialog.alert(t('commands.editor.validation.inputPlaceholder'))
    return
  }

  // save it
  emit('command-modified', {
    id: props.command.id,
    icon: icon.value,
    label: label.value === commandI18n(props.command, 'label') ? undefined : label.value,
    template: template.value === commandI18n(props.command, 'template') ? undefined : template.value,
    action: action.value,
    shortcut: shortcut.value?.toUpperCase() || '',
    engine: engine.value,
    model: model.value
  })
}

defineExpose({
  show: () => document.querySelector<HTMLDialogElement>('#command-editor').showModal(),
  close,
})


</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/editor.css';
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

</style>