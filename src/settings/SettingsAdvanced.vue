
<template>
  <div class="content large">
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
      <label>Image resize</label>
      <select v-model="imageResize" @change="save">
        <option value="0">No resize</option>
        <option value="512">Resize largest dimension to 512 pixels</option>
        <option value="768">Resize largest dimension to 768 pixels</option>
        <option value="1024">Resize largest dimension to 1024 pixels</option>
        <option value="2048">Resize largest dimension to 2048 pixels</option>
      </select>
    </div>
    <div class="group instruction">
      <label>System instructions</label>
      <div class="subgroup">
        <select v-model="instructions" @change="onChangeInstructions">
          <option value="instructions.default">Chat - Instructions</option>
          <option value="instructions.docquery">Document query - Instructions</option>
          <option value="instructions.titling">Chat title - Instructions</option>
          <option value="instructions.titling_user">Chat title - Prompt</option>
          <option value="plugins.image.description">Image Plugin - Description (1024 characters max)</option>
          <option value="plugins.video.description">Video Plugin - Description (1024 characters max)</option>
          <option value="plugins.memory.description">Memory Plugin - Description (1024 characters max)</option>
          <option value="instructions.scratchpad.system">Scratchpad - Instructions</option>
          <option value="instructions.scratchpad.prompt">Scratchpad - Prompt</option>
          <option value="instructions.scratchpad.spellcheck">Scratchpad - Spellcheck</option>
          <option value="instructions.scratchpad.improve">Scratchpad - Improve</option>
          <option value="instructions.scratchpad.takeaways">Scratchpad - Takeaways</option>
          <option value="instructions.scratchpad.title">Scratchpad - Title</option>
          <option value="instructions.scratchpad.simplify">Scratchpad - Simplify</option>
          <option value="instructions.scratchpad.expand">Scratchpad - Expand</option>
          <option value="instructions.scratchpad.complete">Scratchpad - Complete</option>
        </select>
        <textarea v-model="prompt" @change="save" />
        <a href="#" @click="onResetDefaultInstructions">Reset to default value</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, } from 'vue'
import { store } from '../services/store'
import defaults from '../../defaults/settings.json'

const prompt = ref(null)
const instructions = ref('instructions.default')
const autoVisionSwitch = ref(null)
const autoSavePrompt = ref(null)
const conversationLength = ref(null)
const imageResize = ref(null)

const load = () => {
  autoVisionSwitch.value = store.config.llm.autoVisionSwitch
  autoSavePrompt.value = store.config.prompt.autosave
  conversationLength.value = store.config.llm.conversationLength || 5
  imageResize.value = store.config.llm.imageResize || 768
  onChangeInstructions()
}

const onChangeInstructions = () => {
  const tokens = instructions.value.split('.')
  let promptValue = store.config
  for (const token of tokens) {
    // @ts-expect-error - instructions are InstructionsConfig keys
    promptValue = promptValue[token]
  }
  prompt.value = promptValue
}

const onResetDefaultInstructions = () => {
  const tokens = instructions.value.split('.')
  let defaultValue = defaults
  for (const token of tokens) {
    // @ts-expect-error - instructions are InstructionsConfig keys
    defaultValue = defaultValue[token]
  }
  prompt.value = defaultValue
  save()
}

const save = () => {

  // basic stuff
  store.config.llm.autoVisionSwitch = autoVisionSwitch.value
  store.config.prompt.autosave = autoSavePrompt.value
  store.config.llm.conversationLength = conversationLength.value
  store.config.llm.imageResize = parseInt(imageResize.value)

  // update prompt
  const tokens = instructions.value.split('.')
  let config = store.config
  for (let i = 0; i < tokens.length - 1; i++) {
    // @ts-expect-error - instructions are InstructionsConfig keys
    config = config[tokens[i]]
  }
  // @ts-expect-error - instructions are InstructionsConfig keys
  config[tokens[tokens.length - 1]] = prompt.value

  // save
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
  width: 370px;
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

.subgroup select {
  margin-bottom: 0.5rem;
}

.subgroup textarea {
  width: 100%;
  height: 100px;
}

</style>
