<template>
  <dialog class="editor">
    <form method="dialog">
      <header>
        <div class="title">Expert details</div>
      </header>
      <main>
        <div class="group">
          <label>Name</label>
          <input type="text" v-model="name" required />
        </div>
        <div class="group">
          <label>Prompt</label>
          <div class="subgroup">
            <textarea v-model="expert" required></textarea>
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

import { ref, watch } from 'vue'

const emit = defineEmits(['expert-modified']);

const props = defineProps({
  expert: Object
})

const name = ref(null)
const expert = ref(null)

const load = () => {
  name.value = props.expert?.name || ''
  expert.value = props.expert?.prompt || ''
}

// not really sure this is how it supposed to be done
// but at least it works!
watch(() => props.expert || {}, load, { immediate: true })

const onCancel = () => {
  load()
}

const onSave = (event) => {

  // check
  if (!name.value || !expert.value) {
    event.preventDefault()
    alert('All fields marked with * are required.')
    return
  }

  // save it
  emit('expert-modified', {
    id: props.expert.id,
    name: name.value,
    prompt: expert.value,
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