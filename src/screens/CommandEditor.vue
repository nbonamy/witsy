<template>
  <dialog class="command">
    <form method="dialog">
      <header>Command details</header>
      <main>
        <div class="group">
          <label>Label*</label>
          <input type="text" v-model="label" />
        </div>
        <div class="group">
          <label>Prompt*</label>
          <div class="subgroup">
            <textarea v-model="template"></textarea>
            <span v-pre>{input} will be subsituted with highlighted text</span>
          </div>
        </div>
        <div class="group">
          <label>Behavior*</label>
          <select v-model="behavior">
            <option value="new_window">New Window</option>
            <option value="insert_below">Insert Below</option>
            <option value="replace_selection">Replace Selection</option>
            <option value="copy_cliboard">Copy Clipboard</option>
          </select>
        </div>
        <div class="group">
          <label>LLM Provider*</label>
          <select v-model="engine" @change="onChangeEngine">
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama</option>
          </select>
        </div>
        <div class="group">
          <label>LLM Model*</label>
          <select v-model="model">
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
        <div class="group">
          <label>Icon</label>
          <input type="text" v-model="icon" maxlength="1" />
        </div>
      </main>
      <footer>
        <button @click="onSave" class="default">Save</button>
        <button class="destructive">Cancel</button>
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
const behavior = ref(null)
const engine = ref(null)
const model = ref(null)

const models = computed(() => {
  if (!engine.value) return []
  return store.config[engine.value].models.chat
})

// not really sure this is how it supposed to be done
// but at least it works!
watch(() => props.command || {}, () => {
  icon.value = props.command?.icon || '⚡️'
  label.value = props.command?.label || ''
  template.value = props.command?.template || ''
  behavior.value = props.command?.behavior || 'new_window'
  engine.value = props.command?.engine || 'openai'
  model.value = props.command?.model || store.config[engine.value].models.chat[0].id
}, { immediate: true })

const onChangeEngine = () => {
  model.value = store.config[engine.value].models.chat[0].id
}

const onSave = (event) => {

  // check
  if (!label.value || !template.value || !behavior.value || !engine.value || !model.value) {
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
    behavior: behavior.value,
    engine: engine.value,
    model: model.value
  })
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>

<style scoped>

dialog.command header, dialog.command main, dialog.command footer {
  background-color: white;
  border: none;
}

dialog.command header {
  font-size: 10pt;
}

dialog.command main {
  padding-top: 0px;
  padding-bottom: 0px;
}

dialog.command footer {
  justify-content: flex-start;
  flex-direction: row-reverse;
}

dialog.command footer button {
  margin: 0px 4px;
  font-size: 10pt;
}

dialog.command form .group label,
dialog.command form .group input,
dialog.command form .group textarea,
dialog.command form .group select {
  font-size: 10pt;
}

dialog.command form .group label {
  min-width: 100px;
}

dialog.command textarea {
  height: 120px;
}

</style>