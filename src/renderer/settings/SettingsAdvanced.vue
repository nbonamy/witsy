<template>
  <div class="tab-content">
    <header>
      <div class="title">{{ t('settings.tabs.advanced') }}</div>
    </header>
    <main class="form form-vertical form-large">
      <template v-if="isMacOS">
        <div class="form-field">
          <label>{{ t('settings.advanced.permissions.header') }}</label>
          <span>{{ t('settings.advanced.permissions.info') }}</span>
        </div>
        <div class="form-field permissions horizontal">
          <label>{{ t('onboarding.permissions.accessibility.title') }}</label>
          <span v-if="accessibilityGranted" class="granted">{{ t('onboarding.permissions.granted') }}</span>
          <button v-else class="grant-btn" @click="openAccessibilitySettings">{{ t('settings.advanced.permissions.grant') }}</button>
        </div>
        <div class="form-field permissions horizontal">
          <label>{{ t('onboarding.permissions.automation.title') }}</label>
          <span v-if="automationGranted" class="granted">{{ t('onboarding.permissions.granted') }}</span>
          <button v-else class="grant-btn" @click="openAutomationSettings">{{ t('settings.advanced.permissions.grant') }}</button>
        </div>
        <label>&nbsp;</label>
      </template>
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
      <div>
        <div class="form-field http-endpoints horizontal">
          <input type="checkbox" id="http-endpoints" v-model="enableHttpEndpoints" @change="save" />
          <label for="http-endpoints">{{ t('settings.advanced.enableHttpEndpoints') }}</label>
        </div>
        <div style="margin-left: 32px; font-style: italic;" v-if="enableHttpEndpoints">{{ t('settings.advanced.httpServer', { port: httpPort }) }}</div>
      </div>
      <div class="form-field cli-install">
        <button @click="installCLI" :disabled="!enableHttpEndpoints">{{ t('settings.advanced.installCLI') }}</button>
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
import { i18nInstructions, t } from '@services/i18n'

import { computed, onBeforeUnmount, ref } from 'vue'
import { store } from '@services/store'
import { ProxyMode } from 'types/config'
import { anyDict } from 'types/index'

const isMacOS = window.api.platform === 'darwin'

// Permission states (macOS only)
const accessibilityGranted = ref(false)
const automationGranted = ref(false)
let pollInterval: NodeJS.Timeout | null = null

const prompt = ref(null)
const isPromptOverridden = ref(false)
const instructions = ref('instructions.chat.docquery')
const autoSavePrompt = ref(false)
const safeKeys = ref(true)
const enableHttpEndpoints = ref(true)
const proxyMode = ref<ProxyMode>('default')
const customProxy = ref('')
const imageResize = ref(null)

const httpPort = computed(() => window.api.app.getHttpPort())

// Permission check methods (macOS only)
const checkPermissions = async () => {
  if (!isMacOS) return
  try {
    accessibilityGranted.value = await window.api.permissions.checkAccessibility()
    automationGranted.value = await window.api.permissions.checkAutomation()
  } catch (error) {
    console.error('Error checking permissions:', error)
  }
}

const openAccessibilitySettings = async () => {
  try {
    await window.api.permissions.openAccessibilitySettings()
  } catch (error) {
    console.error('Error opening accessibility settings:', error)
  }
}

const openAutomationSettings = async () => {
  try {
    await window.api.permissions.openAutomationSettings()
  } catch (error) {
    console.error('Error opening automation settings:', error)
  }
}

const startPermissionPolling = () => {
  if (!isMacOS || pollInterval) return
  checkPermissions()
  pollInterval = setInterval(checkPermissions, 1000)
}

const stopPermissionPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

onBeforeUnmount(() => {
  stopPermissionPolling()
})

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

const installCLI = async () => {
  const result = await window.api.cli.install()
  if (result.success) {
    alert(t('cli.install.success'))
  }
}

const onShow = () => {
  startPermissionPolling()
}

const onHide = () => {
  stopPermissionPolling()
}

defineExpose({ load, onShow, onHide })
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

.form-field.permissions-info {
  margin: 0;
  span {
    font-size: 0.9rem;
    color: var(--dimmed-text-color);
  }
}

.form-field.permissions {
  margin: 0;
  label {
    flex: 1;
    font-weight: var(--font-weight-regular);
  }
  .granted {
    font-weight: 600;
    color: var(--color-success);
    padding: 0.25rem 0.75rem;
    border: 1px solid transparent;
  }
  .grant-btn {
    padding: 0.25rem 0.75rem;
  }
}

</style>
