<template>
  <dialog class="editor">
    <form method="dialog">
      <header>
        <div class="title">Command details</div>
      </header>
      <main>
        <div class="group">
          <label>Label</label>
          <input type="text" v-model="label" required />
        </div>
        <div class="group">
          <label>Prompt</label>
          <div class="subgroup">
            <textarea v-model="template" required></textarea>
            <span v-pre>{input} will be subsituted with highlighted text</span>
          </div>
        </div>
        <div class="group">
          <label>Action</label>
          <select v-model="action" required>
            <option value="chat_window">Chat Window</option>
            <option value="paste_below">Insert Below</option>
            <option value="paste_in_place">Replace Selection</option>
            <option value="clipboard_copy">Copy to Clipboard</option>
          </select>
        </div>
        <div class="group">
          <label>LLM Provider</label>
          <select v-model="engine" @change="onChangeEngine">
            <option value="">Use commands default</option>
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama</option>
            <option value="anthropic">Anthropic</option>
            <option value="mistralai">MistralAI</option>
            <option value="google">Google</option>
            <option value="groq">Groq</option>
            <option value="cerebras">Cerebras</option>
          </select>
        </div>
        <div class="group">
          <label>LLM Model</label>
          <select v-model="model">
            <option value="" v-if="!models.length">Use commands default</option>
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
        <div class="group">
          <label>Icon</label>
          <!-- maxlength=1 prevents emojis to be "pasted" from mac system window -->
          <input type="text" v-model="icon" class="icon" @keydown="onIconKeyDown" @keyup="onIconKeyUp"/>
        </div>
        <div class="group">
          <label>Shortcut</label>
          <input type="text" v-model="shortcut" class="shortcut" maxlength="1" @keydown="onShortcutKeyDown" @keyup="onShortcutKeyUp" />
        </div>
      </main>
      <footer>
        <button @click="onSave" class="default">Save</button>
        <button @click="onCancel" formnovalidate>Cancel</button>
      </footer>
    </form>
  </dialog>
</template>

<script setup>

import { ref, computed, watch } from 'vue'
import { store } from '../services/store'

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

const onIconKeyDown = (event) => {
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

const onShortcutKeyDown = (event) => {
  shortcut.value = ''
}

const onShortcutKeyUp = (event) => {

  // must be a normal character
  if (event.keyCode < 32) {
    return
  }

  shortcut.value = event.key.toUpperCase()

}

const onCancel = () => {
  load()
}

const onSave = (event) => {

  // check
  if (!label.value || !template.value || !action.value) {
    event.preventDefault()
    alert('All fields marked with * are required.')
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