<template>
  <dialog class="editor" id="docrepocreate">
    <form method="dialog">
      <header>
        <div class="title">Create Document Repository</div>
      </header>
      <main>
        <div class="group" style="margin-bottom: 16px">
          <label></label>
          <span><b>Warning</b>: embedding model cannot be changed once repository is created</span>
        </div>
        <div class="group name">
            <label>Name</label>
            <input type="text" ref="nameInput" v-model="name" required />
          </div>
        <div class="group">
          <label>Embedding Provider</label>
          <select v-model="engine" @change="onChangeEngine" required>
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama</option>
            <!--option value="fastembed">FastEmbed-js</option-->
          </select>
        </div>
        <div class="group">
          <label>Embedding Model</label>
          <select v-model="model" @change="onChangeModel" required>
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
          <button @click.prevent="onRefresh" v-if="canRefresh">{{ refreshLabel }}</button>
        </div>
        <div class="group" style="margin-top: -8px" v-if="engine === 'openai'">
          <label></label>
          <span>Make sure you enter your OpenAI API key in the Models pane of Witsy Settings.</span>
        </div>
        <OllamaModelPull v-if="engine === 'ollama'" :pullable-models="getEmbeddingModels" info-url="https://ollama.com/blog/embedding-models" info-text="Browse models"/>
      </main>
      <footer>
        <button @click="onCreate" class="default">Create</button>
        <button @click="onCancel" formnovalidate>Cancel</button>
      </footer>
    </form>
  </dialog>
</template>

<script setup lang="ts">

import { Model } from 'multi-llm-ts'
import { ref, computed, onMounted, nextTick } from 'vue'
import { store } from '../services/store'
import { getEmbeddingModels } from '../llms/ollama'
import LlmFactory from '../llms/llm'
import OllamaModelPull from '../components/OllamaModelPull.vue'
import Dialog from '../composables/dialog'

// bus
import useEventBus from '../composables/event_bus'
const { onEvent } = useEventBus()

const nameInput = ref(null)
const name = ref('')
const engine = ref('openai')
const model = ref('text-embedding-ada-002')
const refreshLabel = ref('Refresh')

const models = computed(() => {
  if (engine.value === 'openai') {
    return [
      { id: 'text-embedding-ada-002', name: 'text-embedding-ada-002' },
      { id: 'text-embedding-3-small', name: 'text-embedding-3-small' },
      { id: 'text-embedding-3-large', name: 'text-embedding-3-large' },
    ]
  } else if (engine.value === 'ollama') {
    return store.config?.engines?.ollama?.models?.embedding?.map((m: Model) => ({ id: m.id, name: m.name }))
  // } else if (engine.value === 'fastembed') {
  //   return [
  //     { id: 'all-MiniLM-L6-v2', name: 'all-MiniLM-L6-v2' },
  //     { id: 'bge-small-en-v1.5', name: 'bge-small-en-v1.5' },
  //     { id: 'bge-base-en-v1.5', name: 'bge-base-en-v1.5' },
  //     //{ id: 'multilingual-e5-large', name: 'multilingual-e5-large' },
  //   ]
  } else {
    return []
  }
})

const canRefresh = computed(() => engine.value === 'ollama')

onMounted(() => {
  onEvent('open-docrepo-create', onOpen)
  onEvent('ollama-pull-done', onRefresh)
})

const onOpen = () => {
  document.querySelector<HTMLDialogElement>('#docrepocreate').showModal()
  name.value = 'Document Repository'
  nextTick(() => {
    nameInput.value.focus()
    nameInput.value.select()
  })
}

const onChangeEngine = () => {
  model.value = models.value?.[0]?.id
  nextTick(() => {
    onChangeModel()
  })
}

const onChangeModel = () => {
  const downloaded = window.api.docrepo.isEmbeddingAvailable(engine.value, model.value)
  if (!downloaded) {
    Dialog.alert('This model will be downloaded from the internet when adding first document and may take a while.')
  }
}

const onRefresh = async () => {
  refreshLabel.value = 'Refreshing…'
  setTimeout(() => getModels(), 500)
}

const setEphemeralRefreshLabel = (text: string) => {
  refreshLabel.value = text
  setTimeout(() => refreshLabel.value = 'Refresh', 2000)
}

const getModels = async () => {

  // load
  const llmFactory = new LlmFactory(store.config)
  const success = await llmFactory.loadModels('ollama')
  if (!success) {
    setEphemeralRefreshLabel('Error!')
    return
  }

  // reload
  store.saveSettings()

  // select
  onChangeEngine()

  // done
  setEphemeralRefreshLabel('Done!')

}

const onCreate = (event: Event) => {

  // check
  if (!name.value || !engine.value || !model.value) {
    event.preventDefault()
    Dialog.alert('All fields marked with * are required.')
    return
  } 

  // create
  window.api.docrepo.create(name.value, engine.value, model.value)
}

const onCancel = () => {
  document.querySelector<HTMLDialogElement>('#docrepocreate').close()
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
