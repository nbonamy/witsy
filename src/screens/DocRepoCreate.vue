<template>
  <dialog class="editor" id="docrepocreate">
    <form method="dialog">
      <header>
        <div class="title">Create Document Repository</div>
      </header>
      <main>
        <div class="group name">
            <label>Name</label>
            <input type="text" ref="nameInput" v-model="name" />
          </div>
        <div class="group">
          <label>Embedding Provider</label>
          <select v-model="engine" @change="onChangeEngine">
            <option value="openai">OpenAI</option>
            <option value="fastembed">FastEmbed-js</option>
          </select>
        </div>
        <div class="group">
          <label>Embedding Model</label>
          <div class="subgroup">
            <select v-model="model" @change="onChangeModel">
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

import { ref, computed, onMounted, nextTick } from 'vue'

// bus
import useEventBus from '../composables/useEventBus'
const { onEvent } = useEventBus()

const nameInput = ref(null)
const name = ref('')
const engine = ref('openai')
const model = ref('text-embedding-ada-002')

const models = computed(() => {
  if (engine.value === 'openai') {
    return [
      { id: 'text-embedding-ada-002', name: 'text-embedding-ada-002' },
      { id: 'text-embedding-3-small', name: 'text-embedding-3-small' },
      { id: 'text-embedding-3-large', name: 'text-embedding-3-large' },
    ]
  } else if (engine.value === 'fastembed') {
    return [
      { id: 'all-MiniLM-L6-v2', name: 'all-MiniLM-L6-v2' },
      { id: 'bge-small-en-v1.5', name: 'bge-small-en-v1.5' },
      { id: 'bge-base-en-v1.5', name: 'bge-base-en-v1.5' },
      //{ id: 'multilingual-e5-large', name: 'multilingual-e5-large' },
    ]
  } else {
    return []
  }
})

onMounted(() => {
  onEvent('openDocRepoCreate', onOpen)
})

const onOpen = () => {
  document.querySelector('#docrepocreate').showModal()
  name.value = 'Document Repository'
  nextTick(() => {
    nameInput.value.focus()
    nameInput.value.select()
  })
}

const onChangeEngine = (event) => {
  model.value = models.value[0].id
  nextTick(() => {
    onChangeModel()
  })
}

const onChangeModel = (event) => {
  const downloaded = window.api.docrepo.isEmbeddingAvailable(engine.value, model.value)
  if (!downloaded) {
    alert('This model will be downloaded from the internet when adding first document and may take a while.')
  }
}

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
#docrepocreate .group label {
  min-width: 150px;
}
</style>
