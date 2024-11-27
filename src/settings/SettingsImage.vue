<template>
  <div>
    <div class="description">
      This plugin allows LLM engines to create images from a text description.
    </div>
    <div class="group">
      <label>Enabled</label>
      <input type="checkbox" v-model="enabled" @change="save" />
    </div>
    <div class="group">
      <label>Provider</label>
      <select v-model="engine" @change="onChangeEngine">
        <option value="openai">OpenAI</option>
        <option value="huggingface">Hugging Face</option>
        <option value="replicate">Replicate</option>
      </select>
    </div>
    <div class="group" v-if="engine == 'openai'">
      <label>Image model</label>
      <div class="subgroup">
        <select v-model="image_model" :disabled="image_models.length == 0" @change="save">
          <option v-for="model in image_models" :key="model.id" :value="model.id">{{ model.name }}
          </option>
        </select>
        <span>Make sure you enter your OpenAI API key in the Models pane of Witsy Settings.</span>
      </div>
      <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
    </div>
    <div class="group" v-if="engine == 'replicate'">
      <label>API key</label>
      <InputObfuscated v-model="replicateAPIKey" @blur="save" />
    </div>
    <div class="group" v-if="engine == 'replicate'">
      <label>Image model</label>
      <div class="subgroup">
        <Combobox :items="replicate_models" placeholder="Enter a model or select from the list" v-model="image_model" @change="save"/>
        <a href="https://replicate.com/collections/text-to-image" target="_blank">More about Replicate models</a><br/>
      </div>
    </div>
    <div class="group" v-if="engine == 'huggingface'">
      <label>API key</label>
      <InputObfuscated v-model="huggingAPIKey" @blur="save" />
    </div>
    <div class="group" v-if="engine == 'huggingface'">
      <label>Image model</label>
      <div class="subgroup">
        <Combobox :items="hf_models" placeholder="Enter a model or select from the list" v-model="image_model" @change="save"/>
        <a href="https://huggingface.co/models?pipeline_tag=text-to-image&sort=likes" target="_blank">More about Hugging Face models</a><br/>
      </div>
    </div>
  </div>  
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import InputObfuscated from '../components/InputObfuscated.vue'
import Combobox from '../components/Combobox.vue'
import LlmFactory from '../llms/llm'

const enabled = ref(false)
const engine = ref(null)
const huggingAPIKey = ref(null)
const replicateAPIKey = ref(null)
const refreshLabel = ref('Refresh')
const image_model = ref(null)
const image_models = ref([])

const hf_models = ref([
  'black-forest-labs/FLUX.1-schnell',
  'black-forest-labs/FLUX.1-dev',
  'dreamlike-art/dreamlike-photoreal-2.0',
  'prompthero/openjourney',
  'stabilityai/stable-diffusion-3.5-large-turbo',
].sort().map(name => ({ id: name, name })))

const replicate_models = ref([
  'black-forest-labs/flux-1.1-pro',
  'black-forest-labs/flux-schnell',
  'ideogram-ai/ideogram-v2',
  'recraft-ai/recraft-v3-svg',
  'fofr/any-comfyui-workflow',
].sort().map(name => ({ id: name, name })))

const load = () => {
  enabled.value = store.config.plugins.image.enabled || false
  engine.value = store.config.plugins.image.engine || 'openai'
  huggingAPIKey.value = store.config.engines.huggingface?.apiKey || ''
  replicateAPIKey.value = store.config.engines.replicate?.apiKey || ''
  onChangeEngine()
}

const onChangeEngine = () => {
  image_models.value = store.config.engines[engine.value]?.models?.image || []
  image_model.value = store.config.engines[engine.value]?.model?.image || ''
  save()
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
  let success = await llmFactory.loadModels('openai')
  if (!success) {
    image_models.value = []
    setEphemeralRefreshLabel('Error!')
    return
  }

  // reload
  load()

  // done
  setEphemeralRefreshLabel('Done!')

}

const save = () => {
  store.config.plugins.image.enabled = enabled.value
  store.config.plugins.image.engine = engine.value
  store.config.engines.huggingface.apiKey = huggingAPIKey.value
  store.config.engines.replicate.apiKey = replicateAPIKey.value
  store.config.engines[engine.value].model.image = image_model.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
@import '../../css/panel.css';
</style>
