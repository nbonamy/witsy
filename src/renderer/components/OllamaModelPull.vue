<template>
  <div class="form-field pull">
    <label>{{ t('modelPull.label') }}</label>
    <div class="form-subgroup">
      <div class="control-group">
        <ModelSelectPlus
          v-if="false && 'capabilities' in pullableModels[0]"
          id="pull_model"
          :engine="'ollama'"
          :models="pullableModels as ChatModel[]"
          :default-text="t('modelPull.placeholder')"
          :show-ids="true"
          :caps-hover-only="true"
          v-model="pull_model" />
        <Combobox v-else :items="pullableModels" :placeholder="t('modelPull.placeholder')" :show-help="false" name="pull_model" v-model="pull_model" />
        <button v-if="pullStream" name="stop" @click.prevent="onStop">{{ t('common.stop') }}</button>
        <button v-else name="pull" @click.prevent="onPull" :disabled="!pull_model">{{ t('common.pull') }}</button>
        <div class="progress" v-if="pull_progress">{{ pull_progress }}</div>
      </div>
      <a :href="props.infoUrl" target="_blank">{{ t('modelPull.browse') }}</a>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, nextTick, Ref } from 'vue'
import { ChatModel, Ollama } from 'multi-llm-ts'
import { store } from '@services/store'
import { t } from '@services/i18n'
import Dialog from '@renderer/utils/dialog'
import Combobox from './Combobox.vue'
import ModelSelectPlus from './ModelSelectPlus.vue'
import { ProgressResponse } from 'ollama'
import type { A as AbortableAsyncIterator } from 'ollama/dist/shared/ollama.1bfa89da.cjs'

type Model = {
  id: string,
  name: string,
}

const props = defineProps({
  pullableModels: {
    type: Array<Model|ChatModel>,
    required: true,
  },
  infoUrl: String,
  infoText: String,
})

const emit = defineEmits(['done'])

const pull_model= ref<string|null>(null)
const pull_progress= ref<string|null>(null)
const pullStream: Ref<AbortableAsyncIterator<ProgressResponse>|null> = ref(null)

let ollama = new Ollama(store.config.engines.ollama)

const onPull = () => {
  // need a model and can pull only one at a time
  if (!pull_model.value) return
  if (pullStream.value) return
  pull_progress.value = t('modelPull.progress')
  
  // do it
  nextTick(async () => {

    try {
      // start pulling
      pullStream.value = await ollama.pullModel(pull_model.value!)

      // TODO: handle error (this is not working)
      if (!pullStream.value) {
        Dialog.alert(t('modelPull.error'))
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

    } catch (error) {
      console.error(error)
      pull_progress.value = null
      pullStream.value = null
      Dialog.alert(t('modelPull.error'))
    }
  
  })
}

const onStop = async () => {
  ollama.stop()
  pull_progress.value = null
  pullStream.value = null
}
</script>


<style scoped>

.pull .form-subgroup {
  flex: 1;
}

.progress {
  padding: 10px 4px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: 12.5px;
  color: var(--icon-color);
  white-space: nowrap;
}

</style>