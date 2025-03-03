<template>
  <div class="content large">
    <div class="group vision top checkbox">
      <label>{{ t('settings.advanced.autoVisionSwitch') }}</label>
      <input type="checkbox" v-model="autoVisionSwitch" @change="save" />
    </div>
    <div class="group autosave checkbox">
      <label>{{ t('settings.advanced.autoSavePrompt') }}</label>
      <input type="checkbox" v-model="autoSavePrompt" @change="save" />
    </div>
    <hr/>
    <div class="group length">
      <label>{{ t('settings.advanced.conversationLength') }}</label>
      <input type="number" min="1" v-model="conversationLength" @change="save">
    </div>
    <div class="group size">
      <label>{{ t('settings.advanced.imageResize') }}</label>
      <select v-model="imageResize" @change="save">
        <option value="0">{{ t('settings.advanced.imageResizeOptions.none') }}</option>
        <option value="512">{{ t('settings.advanced.imageResizeOptions.size', { size: 512 }) }}</option>
        <option value="768">{{ t('settings.advanced.imageResizeOptions.size', { size: 768 }) }}</option>
        <option value="1024">{{ t('settings.advanced.imageResizeOptions.size', { size: 1024 }) }}</option>
        <option value="2048">{{ t('settings.advanced.imageResizeOptions.size', { size: 2048 }) }}</option>
      </select>
    </div>
    <div class="group instruction">
      <label>{{ t('settings.advanced.systemInstructions') }}</label>
      <div class="subgroup">
        <select v-model="instructions" @change="onChangeInstructions">
          <option value="instructions.default">{{ t('settings.advanced.instructions.chat') }}</option>
          <option value="instructions.docquery">{{ t('settings.advanced.instructions.docquery') }}</option>
          <option value="instructions.titling">{{ t('settings.advanced.instructions.titling') }}</option>
          <option value="instructions.titllingUser">{{ t('settings.advanced.instructions.titllingUser') }}</option>
          <option value="plugins.image.description">{{ t('settings.advanced.instructions.image_plugin') }}</option>
          <option value="plugins.video.description">{{ t('settings.advanced.instructions.video_plugin') }}</option>
          <option value="plugins.memory.description">{{ t('settings.advanced.instructions.memory_plugin') }}</option>
          <option value="instructions.scratchpad.system">{{ t('settings.advanced.instructions.scratchpad_system') }}</option>
          <option value="instructions.scratchpad.prompt">{{ t('settings.advanced.instructions.scratchpad_prompt') }}</option>
          <option value="instructions.scratchpad.spellcheck">{{ t('settings.advanced.instructions.scratchpad_spellcheck') }}</option>
          <option value="instructions.scratchpad.improve">{{ t('settings.advanced.instructions.scratchpad_improve') }}</option>
          <option value="instructions.scratchpad.takeaways">{{ t('settings.advanced.instructions.scratchpad_takeaways') }}</option>
          <option value="instructions.scratchpad.title">{{ t('settings.advanced.instructions.scratchpad_title') }}</option>
          <option value="instructions.scratchpad.simplify">{{ t('settings.advanced.instructions.scratchpad_simplify') }}</option>
          <option value="instructions.scratchpad.expand">{{ t('settings.advanced.instructions.scratchpad_expand') }}</option>
          <option value="instructions.scratchpad.complete">{{ t('settings.advanced.instructions.scratchpad_complete') }}</option>
        </select>
        <textarea v-model="prompt" @change="save" @keyup="save" />
        <a href="#" @click="onResetDefaultInstructions" v-if="isPromptOverridden">{{ t('settings.advanced.resetToDefault') }}</a>
        <span v-else>{{ t('settings.advanced.overridingHelp') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t, i18nInstructions } from '../services/i18n'

import { ref } from 'vue'
import { store } from '../services/store'
import { anyDict } from '../types/index'

const prompt = ref(null)
const isPromptOverridden = ref(false)
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
  prompt.value = i18nInstructions(store.config, instructions.value)
  isPromptOverridden.value = (prompt.value !== i18nInstructions(null, instructions.value));
}

const onResetDefaultInstructions = () => {
  prompt.value = i18nInstructions(null, instructions.value)
  save()
}

const save = () => {

  // basic stuff
  store.config.llm.autoVisionSwitch = autoVisionSwitch.value
  store.config.prompt.autosave = autoSavePrompt.value
  store.config.llm.conversationLength = conversationLength.value
  store.config.llm.imageResize = parseInt(imageResize.value)

  // update prompt
  const defaultInstructions = i18nInstructions(null, instructions.value)
  isPromptOverridden.value = (prompt.value !== defaultInstructions);
  instructions.value.split('.').reduce((acc, key, i, arr) => {
    if (i === arr.length - 1) {
      if (isPromptOverridden.value) {
        acc[key] = prompt.value
      } else {
        delete acc[key]
      }
    } else if (!acc[key]) {
      acc[key] = {}
    } 
    return acc[key]
  }, store.config as anyDict)

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

form .group label {
  min-width: 180px;
}

.subgroup select {
  margin-bottom: 0.5rem;
}

.subgroup textarea {
  width: 100%;
  height: 100px;
}
</style>
