<template>
  <div>
    <div class="description">
      This plugin allows LLM engines to create videos from a text description.
    </div>
    <div class="group">
      <label>Enabled</label>
      <input type="checkbox" v-model="enabled" @change="save" />
    </div>
    <div class="group">
      <label>Provider</label>
      <select v-model="engine" @change="onChangeEngine">
        <option value="replicate">Replicate</option>
      </select>
    </div>
    <div class="group" v-if="engine == 'replicate'">
      <label>API key</label>
      <InputObfuscated v-model="replicateAPIKey" @blur="save" />
    </div>
    <div class="group" v-if="engine == 'replicate'">
      <label>Video model</label>
      <div class="subgroup">
        <Combobox :items="replicate_models" placeholder="Enter a model or select from the list" v-model="video_model" @change="save"/>
        <a href="https://replicate.com/collections/text-to-video" target="_blank">More about Replicate models</a><br/>
      </div>
    </div>
  </div>  
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { store } from '../services/store'
import InputObfuscated from '../components/InputObfuscated.vue'
import Combobox from '../components/Combobox.vue'

const enabled = ref(false)
const engine = ref(null)
const replicateAPIKey = ref(null)
const video_model = ref(null)
const video_models = ref([])

const replicate_models = ref([
  'minimax/video-01',
  'minimax/video-01-live',
  'tencent/hunyuan-video',
  'fofr/Itx-video',
  'luma/ray',
  'haiper-ai/haiper-video-2',
  'genmoai/mochi-1'
].map(name => ({ id: name, name })))

const load = () => {
  enabled.value = store.config.plugins.video.enabled || false
  engine.value = store.config.plugins.video.engine || 'openai'
  replicateAPIKey.value = store.config.engines.replicate?.apiKey || ''
  onChangeEngine()
}

const onChangeEngine = () => {
  video_models.value = store.config.engines[engine.value]?.models?.video || []
  video_model.value = store.config.engines[engine.value]?.model?.video || ''
  save()
}

const save = () => {
  store.config.plugins.video.enabled = enabled.value
  store.config.plugins.video.engine = engine.value
  store.config.engines.replicate.apiKey = replicateAPIKey.value
  store.config.engines[engine.value].model.video = video_model.value
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
