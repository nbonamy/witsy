<template>
  <dialog class="editor">
    <form method="dialog">
      <header>
        <div class="title">{{ t('commands.editor.title') }}</div>
      </header>
      <main>
        <div class="group">
          <label>{{ t('common.name') }}</label>
          <input type="text" v-model="label" required />
        </div>
        <div class="group">
          <label>{{ t('commands.editor.prompt') }}</label>
          <div class="subgroup">
            <textarea v-model="template" v-if="isEditable"></textarea>
            <textarea v-else disabled="true">{{ t('commands.editor.notEditable') }}</textarea>
            <span>{{ t('commands.editor.inputPlaceholder') }}</span>
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
          <input type="text" v-model="icon" class="icon" @keydown="onIconKeyDown" @keyup="onIconKeyUp"/>
        </div>
        <div class="group">
          <label>{{ t('common.shortcut') }}</label>
          <input type="text" v-model="shortcut" class="shortcut" maxlength="1" @keydown="onShortcutKeyDown" @keyup="onShortcutKeyUp" />
        </div>
      </main>
      <footer>
        <button @click="onSave" class="default">{{ t('common.save') }}</button>
        <button @click="onCancel" formnovalidate>{{ t('common.cancel') }}</button>
      </footer>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n' 
const { t } = useI18n()

import { ref, computed, watch } from 'vue'
import { store } from '../services/store'
import EngineSelect from '../components/EngineSelect.vue'
import ModelSelect from '../components/ModelSelect.vue'
import Dialog from '../composables/dialog'

const emit = defineEmits(['command-modified']);

const props = defineProps({
  command: Object
})

const icon = ref(null)
const label = ref(null)
const template = ref(null)
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

const load = () => {
  icon.value = props.command?.icon || '⚡️'
  label.value = props.command?.label || ''
  template.value = props.command?.template || ''
  action.value = props.command?.action || 'chat_window'
  shortcut.value = props.command?.shortcut
  engine.value = props.command?.engine
  model.value = props.command?.model
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

const onCancel = () => {
  load()
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
    label: label.value,
    template: template.value,
    action: action.value,
    shortcut: shortcut.value?.toUpperCase() || '',
    engine: engine.value,
    model: model.value
  })
}

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