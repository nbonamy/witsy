
<template>
  <div class="group pull">
    <label>Pull nodel</label>
    <div class="subgroup">
      <input type="text" v-model="pull_model" placeholder="Enter a model to pull">
      <select v-model="pull_model_select" @change="onSelectPullModel">
        <option disabled value="">Or select one from this list</option>
        <option v-for="model in pullableModels" :key="model.id" :value="model.id">
          {{ model.name }}
        </option>
      </select>
      <a :href="props.infoUrl" target="_blank">{{ props.infoText }}</a>
    </div>
    <div>
      <button @click.prevent="onStop" v-if="pullStream">Stop</button>
      <button @click.prevent="onPull" v-else>Pull</button>
      <div class="progress" v-if="pull_progress">{{  pull_progress }}</div>
    </div>
  </div>
</template>

<script setup>

import { ref, onMounted, nextTick } from 'vue'
import { store } from '../services/store'
import { loadOllamaModels } from '../services/llm'
import Ollama from '../services/ollama'

// bus
import useEventBus from '../composables/useEventBus'
const { emitEvent } = useEventBus()

const props = defineProps({
  pullableModels: Array,
  infoUrl: String,
  infoText: String,
})

const pull_model = ref(null)
const pull_model_select = ref('')
const pull_progress = ref(null)
const pullStream = ref(null)

let ollama = new Ollama(store.config)

const onSelectPullModel = () => {
  pull_model.value = pull_model_select.value
  pull_model_select.value = ''
}

const onPull = () => {
  // need a model and can pull only one at a time
  if (!pull_model.value) return
  if (pullStream.value) return
  pull_progress.value = '…'
  
  // do it
  nextTick(async () => {

    // start pulling
    pullStream.value = await ollama.pullModel(pull_model.value)

    // TODO: handle error (this is not working)
    if (!pullStream.value) {
      alert('Error pulling model')
      pull_progress.value = null
      return
    }

    // report progress
    try {
      for await (const progress of pullStream.value) {
        const percent = Math.floor(progress.completed / progress.total * 100)
        if (!isNaN(percent)) {
          pull_progress.value = percent + '%'
        }
      }
    } catch {}

    // done
    pull_progress.value = null
    pull_model.value = null
    pullStream.value = null
    emitEvent('ollamaPullDone')

  })
}

const onStop = async () => {
  ollama.stop()
  pull_progress.value = null
  pullStream.value = null
}

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
@import '../../css/panel.css';
</style>

<style scoped>

.pull .subgroup select {
  margin-top: 4px;
  color: #757575;
}

.progress {
  padding: 10px 4px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: 9.5pt;
  color: #666;
}

</style>