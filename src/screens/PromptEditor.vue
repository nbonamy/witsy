<template>
  <dialog class="editor">
    <form method="dialog">
      <header>
        <div class="title">Expert details</div>
      </header>
      <main>
        <div class="group">
          <label>Expert</label>
          <input type="text" v-model="actor" required />
        </div>
        <div class="group">
          <label>Prompt</label>
          <div class="subgroup">
            <textarea v-model="prompt" required></textarea>
            <span v-pre>Text between quotes will be automatically selected to be easily modified</span>
          </div>
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

const emit = defineEmits(['prompt-modified']);

const props = defineProps({
  prompt: Object
})

const actor = ref(null)
const prompt = ref(null)

const load = () => {
  actor.value = props.prompt?.actor || ''
  prompt.value = props.prompt?.prompt || ''
}

// not really sure this is how it supposed to be done
// but at least it works!
watch(() => props.prompt || {}, load, { immediate: true })

const onCancel = () => {
  load()
}

const onSave = (event) => {

  // check
  if (!actor.value || !prompt.value) {
    event.preventDefault()
    alert('All fields marked with * are required.')
    return
  }

  // save it
  emit('prompt-modified', {
    id: props.prompt.id,
    actor: actor.value,
    prompt: prompt.value,
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