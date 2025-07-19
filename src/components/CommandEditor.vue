<template>
  <div class="command-editor" @keydown.enter.prevent="onSave">
    <div class="form-field" v-if="diffLang" style="margin-top: 16px; margin-bottom: 24px">
      <label class="no-colon"><BIconExclamationCircle /></label>
      <div>{{ t('common.differentLocales') }}</div>
    </div>
    <div class="form-field">
      <label>{{ t('common.name') }}</label>
      <input type="text" name="label" v-model="label" required @keyup="onChangeText" />
    </div>
    <div class="form-field">
      <label>{{ t('commands.editor.prompt') }}</label>
      <div class="form-subgroup">
        <textarea name="template" v-model="template" required @keyup="onChangeText" v-if="isEditable"></textarea>
        <textarea name="template" disabled="true" v-else>{{ t('commands.editor.notEditable') }}</textarea>
        <span>{{ t('commands.editor.inputPlaceholder') }}</span>
        <a href="#" name="reset" @click="onReset" v-if="isEdited">{{ t('commands.editor.resetToDefault') }}</a>
      </div>
    </div>
    <div class="form-field">
      <label>{{ t('common.llmProvider') }}</label>
      <EngineSelect v-model="engine" @change="onChangeEngine" :default-text="t('commands.editor.useDefault')" />
    </div>
    <div class="form-field">
      <label>{{ t('common.llmModel') }}</label>
      <ModelSelectPlus id="model" v-model="model" :engine="engine" :default-text="!models.length ? t('commands.editor.useDefault') : ''" />
    </div>
    <div class="form-field">
      <label>{{ t('common.icon') }}</label>
      <!-- maxlength=1 prevents emojis to be "pasted" from mac system window -->
      <input type="text" name="icon" v-model="icon" class="icon" @keydown="onIconKeyDown" @keyup="onIconKeyUp"/>
    </div>
    <div class="form-field">
      <label>{{ t('common.shortcut') }}</label>
      <div class="form-subgroup">
        <input type="text" name="shortcut" v-model="shortcut" class="shortcut" maxlength="1" @keydown="onShortcutKeyDown" @keyup="onShortcutKeyUp" />
        {{ t('commands.editor.shortcutDescription') }}
      </div>
    </div>
    <div class="buttons">
      <button type="button" @click="onCancel" formnovalidate>{{ t('common.cancel') }}</button>
      <button type="button" @click="onSave" class="default">{{ t('common.save') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">

import { Command } from '../types/index'
import { onMounted, ref, computed, watch, PropType } from 'vue'
import { store } from '../services/store'
import { t, commandI18n, commandI18nDefault } from '../services/i18n'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelectPlus from '../components/ModelSelectPlus.vue'
import Dialog from '../composables/dialog'

const emit = defineEmits(['command-modified']);

const props = defineProps({
  command: Object as PropType<Command>,
})

const icon = ref(null)
const label = ref(null)
const template = ref(null)
const action = ref(null)
const shortcut = ref(null)
const engine = ref(null)
const model = ref(null)
const diffLang = ref(false)
const isEdited = ref(false)

const models = computed(() => {
  if (!engine.value || engine.value == '') return []
  return store.config.engines[engine.value].models.chat
})

const isEditable = computed(() => {
  return window.api.commands.isPromptEditable(props.command?.id)
})

const onChangeText = () => {
  if (!props.command) isEdited.value = false
  isEdited.value = ((props.command?.type === 'system') && (label.value !== commandI18nDefault(props.command, 'label') || template.value !== commandI18nDefault(props.command, 'template')))
}

onMounted(async () => {
  watch(() => props || {}, async () => {

    // update values
    icon.value = props.command?.icon || '⚡️'
    label.value = props.command?.label || commandI18n(props.command, 'label')
    template.value = props.command?.id ? (props.command?.template || commandI18n(props.command, 'template')) : ''
    action.value = props.command?.action || 'chat_window'
    shortcut.value = props.command?.shortcut
    engine.value = props.command?.engine
    model.value = props.command?.model
    diffLang.value = window.api.config.localeUI() !== window.api.config.localeLLM()
    onChangeText()

  }, { deep: true, immediate: true })

})

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
  emit('command-modified')
}

const onCancel = () => {
  close()
}

const onReset = () => {
  label.value = commandI18nDefault(props.command, 'label')
  template.value = commandI18nDefault(props.command, 'template')
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
    label: label.value === commandI18nDefault(props.command, 'label') ? undefined : label.value,
    template: template.value === commandI18nDefault(props.command, 'template') ? undefined : template.value,
    action: action.value,
    shortcut: shortcut.value?.toUpperCase() || '',
    engine: engine.value,
    model: model.value
  })
}

</script>


<style scoped>

.command-editor {

  textarea {
    height: 120px;
    resize: vertical !important;
  }

  .form-field input.icon {
    width: 32px;
    text-align: center;
  }

  .form-field .form-subgroup:has(.shortcut) {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    input.shortcut {
      width: 32px;
      text-align: center;
      text-transform: uppercase;
    }
  }

}

.windows .command-editor .icon {
  font-family: 'NotoColorEmojiLimited';
  font-size: 9pt;
}

</style>