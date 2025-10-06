<template>
  <div class="tab-content">
    <header>
      <div class="title">{{ t('settings.tabs.advanced') }}</div>
    </header>
    <main class="form form-vertical form-large">
      <div class="form-field">
        <label>{{ t('settings.advanced.header') }}</label>
      </div>
      <div class="form-field autosave horizontal">
        <input type="checkbox" id="auto-save-prompt" v-model="autoSavePrompt" @change="save" />
        <label for="auto-save-prompt">{{ t('settings.advanced.autoSavePrompt') }}</label>
      </div>
      <div class="form-field safe-keys horizontal">
        <input type="checkbox" id="safe-keys" v-model="safeKeys" @change="save" />
        <label for="safe-keys">{{ t('settings.advanced.safeKeys') }}</label>
      </div>
      <div class="form-field http-endpoints horizontal">
        <input type="checkbox" id="http-endpoints" v-model="enableHttpEndpoints" @change="save" />
        <label for="http-endpoints">{{ t('settings.advanced.enableHttpEndpoints') }}</label>
      </div>
      <label>&nbsp;</label>
      <div class="form-field proxy">
        <label>{{ t('settings.advanced.proxy.title') }}</label>
        <select name="proxyMode" v-model="proxyMode" @change="save">
          <option value="default">{{ t('settings.advanced.proxy.default') }}</option>
          <option value="bypass">{{ t('settings.advanced.proxy.bypass') }}</option>
          <option value="custom">{{ t('settings.advanced.proxy.custom') }}</option>
        </select>
      </div>
      <div class="form-field custom-proxy" v-if="proxyMode === 'custom'">
        <label>{{ t('settings.advanced.proxy.custom') }}</label>
        <input type="text" name="customProxy" v-model="customProxy" @change="save">
      </div>
      <div class="form-field size">
        <label>{{ t('settings.advanced.imageResize') }}</label>
        <select v-model="imageResize" @change="save">
          <option value="0">{{ t('settings.advanced.imageResizeOptions.none') }}</option>
          <option value="512">{{ t('settings.advanced.imageResizeOptions.size', { size: 512 }) }}</option>
          <option value="768">{{ t('settings.advanced.imageResizeOptions.size', { size: 768 }) }}</option>
          <option value="1024">{{ t('settings.advanced.imageResizeOptions.size', { size: 1024 }) }}</option>
          <option value="2048">{{ t('settings.advanced.imageResizeOptions.size', { size: 2048 }) }}</option>
        </select>
      </div>
      <div class="form-field instruction">
        <label>{{ t('settings.advanced.systemInstructions') }}</label>
        <div class="form-subgroup">
          <select v-model="instructions" @change="onChangeInstructions">
            <!-- <option value="instructions.chat.standard">{{ t('settings.advanced.instructions.chat_standard') }}</option>
            <option value="instructions.chat.structured">{{ t('settings.advanced.instructions.chat_structured') }}</option>
            <option value="instructions.chat.playful">{{ t('settings.advanced.instructions.chat_playful') }}</option>
            <option value="instructions.chat.empathic">{{ t('settings.advanced.instructions.chat_empathic') }}</option>
            <option value="instructions.chat.uplifting">{{ t('settings.advanced.instructions.chat_uplifting') }}</option>
            <option value="instructions.chat.reflective">{{ t('settings.advanced.instructions.chat_reflective') }}</option>
            <option value="instructions.chat.visionary">{{ t('settings.advanced.instructions.chat_visionary') }}</option> -->
            <option value="instructions.chat.docquery">{{ t('settings.advanced.instructions.docquery') }}</option>
            <option value="instructions.utils.titling">{{ t('settings.advanced.instructions.titling') }}</option>
            <option value="instructions.utils.titlingUser">{{ t('settings.advanced.instructions.titlingUser') }}</option>
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
          <textarea v-model="prompt" @input="save" />
          <a href="#" @click="onResetDefaultInstructions" v-if="isPromptOverridden">{{ t('settings.advanced.resetToDefault') }}</a>
          <span v-else>{{ t('settings.advanced.overridingHelp') }}</span>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { t, i18nInstructions } from '../services/i18n'

import { ref } from 'vue'
import { store } from '../services/store'
import { anyDict } from '../types/index'
import { ProxyMode } from '../types/config'

const prompt = ref(null)
const isPromptOverridden = ref(false)
const instructions = ref('instructions.chat.docquery')
const autoSavePrompt = ref(false)
const safeKeys = ref(true)
const enableHttpEndpoints = ref(true)
const proxyMode = ref<ProxyMode>('default')
const customProxy = ref('')
const imageResize = ref(null)

const load = () => {
  autoSavePrompt.value = store.config.prompt.autosave
  safeKeys.value = store.config.general.safeKeys
  enableHttpEndpoints.value = store.config.general.enableHttpEndpoints
  proxyMode.value = store.config.general.proxyMode
  customProxy.value = store.config.general.customProxy
  imageResize.value = store.config.llm.imageResize ?? 768
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
  store.config.prompt.autosave = autoSavePrompt.value
  store.config.general.safeKeys = safeKeys.value
  store.config.general.enableHttpEndpoints = enableHttpEndpoints.value
  store.config.general.proxyMode = proxyMode.value
  store.config.general.customProxy = customProxy.value
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

.settings .tab-content main {
  min-width: 600px;
}

.form.form-vertical .form-field .form-subgroup {

  select {
    margin-bottom: 0.5rem;
  }

  textarea {
    height: 150px;
    resize: vertical !important;
  }

  span, a {
    display: block;
  }

}

</style>
