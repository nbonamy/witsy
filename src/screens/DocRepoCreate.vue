<template>
  <dialog class="editor">
    <form method="dialog">
      <header>
        <div class="title">Create Document Repository</div>
      </header>
      <main>
        <div class="group name">
            <label>Name</label>
            <input type="text" v-model="name" />
          </div>
        <div class="group">
          <label>Embedding Provider</label>
          <select v-model="engine" @change="onChangeEngine">
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <div class="group">
          <label>Embedding Model</label>
          <div class="subgroup">
            <select v-model="model">
              <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
            <span>Warning: embedding model cannot be changed once repository is created</span>
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

const name = ref('Document Repository')
const engine = ref('openai')
const model = ref('text-embedding-ada-002')

const models = computed(() => {
  if (engine.value === 'openai') {
    return [
    { id: 'text-embedding-ada-002', name: 'text-embedding-ada-002' },
    { id: 'text-embedding-3-small', name: 'text-embedding-3-small' },
    { id: 'text-embedding-3-large', name: 'text-embedding-3-large' },
    ]
  } else {
    return []
  }
})

const onSave = (event) => {
  window.api.docrepo.create(name.value, engine.value, model.value)
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
@import '../../css/editor.css';
</style>

<style scoped>
#create .group label {
  min-width: 150px;
}
</style>
