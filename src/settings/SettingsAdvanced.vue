
<template>
  <div class="content">
    <div class="group vision top checkbox">
      <label>Automatically switch to vision model</label>
      <input type="checkbox" v-model="autoVisionSwitch" @change="save" />
    </div>
    <div class="group autosave checkbox">
      <label>Always save prompt sessions in chat history</label>
      <input type="checkbox" v-model="autoSavePrompt" @change="save" />
    </div>
    <hr/>
    <div class="group length">
      <label>Conversation length</label>
      <input type="number" min="1" v-model="conversationLength" @change="save">
    </div>
    <div class="group size">
      <label>Image Resize</label>
      <select v-model="imageResize" @change="save">
        <option value="0">No resize</option>
        <option value="512">Resize largest dimension to 512 pixels</option>
        <option value="768">Resize largest dimension to 768 pixels</option>
        <option value="1024">Resize largest dimension to 1024 pixels</option>
        <option value="2048">Resize largest dimension to 2048 pixels</option>
      </select>
    </div>
    <div class="group instruction">
      <label>Default instructions</label>
      <div class="subgroup">
        <textarea v-model="defaultInstructions" @change="save" />
        <a href="#" @click="onResetDefaultInstructions">Reset to default value</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, } from 'vue'
import { store } from '../services/store'
import defaults from '../../defaults/settings.json'

const defaultInstructions = ref(null)
const autoVisionSwitch = ref(null)
const autoSavePrompt = ref(null)
const conversationLength = ref(null)
const imageResize = ref(null)

const load = () => {
  autoVisionSwitch.value = store.config.llm.autoVisionSwitch
  autoSavePrompt.value = store.config.prompt.autosave
  defaultInstructions.value = store.config.instructions.default || ''
  conversationLength.value = store.config.llm.conversationLength || 5
  imageResize.value = store.config.llm.imageResize || 768
}

const onResetDefaultInstructions = () => {
  defaultInstructions.value = defaults.instructions.default
  save()
}

const save = () => {
  store.config.llm.autoVisionSwitch = autoVisionSwitch.value
  store.config.prompt.autosave = autoSavePrompt.value
  store.config.instructions.default = defaultInstructions.value
  store.config.llm.conversationLength = conversationLength.value
  store.config.llm.imageResize = parseInt(imageResize.value)
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/tabs.css';
@import '../../css/form.css';
</style>

<style scoped>

.checkbox label {
  width: 300px;
}

hr {
  display: block;
  height: 1px;
  border: 0;
  border-top: 1px solid var(--control-bg-color);
  margin: 1em 0;
  padding: 0;

}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

</style>
