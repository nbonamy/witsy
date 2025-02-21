
<template>
  <div class="group pull">
    <label>Pull model</label>
    <div class="subgroup">
      <Combobox class="combobox" :items="pullableModels" placeholder="Enter a model name to pull or select one" v-model="pull_model" />
      <a :href="props.infoUrl" target="_blank">{{ props.infoText }}</a>
    </div>
    <div>
      <button @click.prevent="onStop" v-if="pullStream">Stop</button>
      <button @click.prevent="onPull" v-else>Pull</button>
      <div class="progress" v-if="pull_progress">{{  pull_progress }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, nextTick, Ref } from 'vue'
import { Ollama } from 'multi-llm-ts'
import { store } from '../services/store'
import Dialog from '../composables/dialog'
import Combobox from './Combobox.vue'
import { ProgressResponse, AbortableAsyncIterator } from 'ollama'

 type Model = {
  id: string,
  name: string,
}

const props = defineProps({
  pullableModels: {
    type: Array<Model>,
    required: true,
  },
  infoUrl: String,
  infoText: String,
})

const emit = defineEmits(['done'])

const pull_model: Ref<string|null> = ref(null)
const pull_progress: Ref<string|null> = ref(null)
const pullStream: Ref<AbortableAsyncIterator<ProgressResponse>|null> = ref(null)

let ollama = new Ollama(store.config.engines.ollama)

const onPull = () => {
  // need a model and can pull only one at a time
  if (!pull_model.value) return
  if (pullStream.value) return
  pull_progress.value = '…'
  
  // do it
  nextTick(async () => {

    // start pulling
    //@ts-expect-error version mismatch because of direct import
    pullStream.value = await ollama.pullModel(pull_model.value!)

    // TODO: handle error (this is not working)
    if (!pullStream.value) {
      Dialog.alert('Error pulling model')
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
    emit('done')

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

.pull .subgroup {
  flex: 1;
}

.progress {
  padding: 10px 4px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: 9.5pt;
  color: var(--icon-color);
}

</style>