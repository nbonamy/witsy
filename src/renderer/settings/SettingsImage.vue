<template>
  <div class="form form-vertical form-large">

    <div class="description">
      {{ t('settings.plugins.image.description') }}
    </div>

    <div class="form-field horizontal">
      <input type="checkbox" id="image-enabled" v-model="enabled" @change="save" />
      <label for="image-enabled">{{ t('common.enabled') }}</label>
    </div>

    <div class="form-field">
      <label>{{ t('settings.plugins.image.provider') }}</label>
      <div class="form-subgroup">
        <select v-model="engine" @change="onChangeEngine">
          <option v-for="engine in engines" :value="engine.id">{{ engine.name }}</option>
        </select>
        <a href="https://github.com/ollama/ollama/blob/main/docs/api.md#image-generation-experimental" target="_blank" v-if="engine === 'ollama'">{{ t('settings.plugins.image.ollama.aboutImageGeneration') }}</a>
      </div>
    </div>

    <template v-if="['openai', 'google', 'xai'].includes(engine)">
      <div class="form-field">
        <label>{{ t('settings.plugins.image.imageModel') }}</label>
        <div class="form-subgroup">
          <div class="control-group">
            <select v-model="model" :disabled="models.length == 0" @change="save">
              <option v-for="model in models" :key="model.id" :value="model.id">{{ model.name }}
              </option>
            </select>
            <RefreshButton :on-refresh="getModels" />
          </div>
          <span>{{ t('settings.plugins.image.apiKeyReminder') }}</span>
        </div>
      </div>
    </template>

    <template v-else-if="engine == 'sdwebui'">
      <div class="form-field">
        <label>{{ t('settings.engines.sdwebui.baseURL') }}</label>
        <div class="form-subgroup">
          <input type="text" v-model="sdwebuiBaseURL" :placeholder="sdwebuiDefaultBaseURL" @blur="save" />
          <a href="https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/API" target="_blank">{{ t('settings.engines.sdwebui.ensureApiMode') }}</a>
        </div>
      </div>
      <div class="form-field">
        <label>{{ t('settings.plugins.image.imageModel') }}</label>
        <div class="control-group">
          <select v-model="model" :disabled="models.length == 0" @change="save">
            <option v-for="model in models" :key="model.id" :value="model.id">{{ model.name }}
            </option>
          </select>
          <RefreshButton :on-refresh="getModels" />
        </div>
      </div>
    </template>

    <template v-else-if="engine == 'ollama'">
      <div class="form-field">
        <label>{{ t('settings.plugins.image.imageModel') }}</label>
        <div class="control-group">
          <select v-model="model" :disabled="models.length == 0" @change="save">
            <option v-for="model in models" :key="model.id" :value="model.id">{{ model.name }}
            </option>
          </select>
          <RefreshButton :on-refresh="getModels" />
        </div>
      </div>
      <OllamaModelPull :pullable-models="ollamaImageModels" info-url="https://ollama.com/search?q=image" @done="getModels" />
      <div class="form-field">
        <label>{{ t('settings.engines.ollama.apiBaseURL') }}</label>
        <input type="text" v-model="ollamaBaseURL" :placeholder="ollamaDefaultBaseURL" @blur="save" />
      </div>
    </template>

    <template v-else>
      <div class="form-field">
        <label>{{ t('settings.engines.apiKey') }}</label>
        <InputObfuscated v-if="engine === 'falai'" v-model="falaiAPIKey" @blur="save" />
        <InputObfuscated v-if="engine === 'huggingface'" v-model="huggingAPIKey" @blur="save" />
        <InputObfuscated v-if="engine === 'replicate'" v-model="replicateAPIKey" @blur="save" />
      </div>
      <div class="form-field">
        <label>{{ t('settings.plugins.image.imageModel') }}</label>
        <div class="form-subgroup">
          <Combobox :items="models" :placeholder="t('common.modelPlaceholder')" v-model="model" @change="save">
            <RefreshButton :on-refresh="getModels" />
          </Combobox>
          <a v-if="engine === 'falai'" href="https://fal.ai/models?categories=text-to-image" target="_blank">{{ t('settings.plugins.image.falai.aboutModels') }}</a>
          <a v-if="engine === 'huggingface'" href="https://huggingface.co/models?pipeline_tag=text-to-image&sort=likes" target="_blank">{{ t('settings.plugins.image.huggingface.aboutModels') }}</a>
          <a v-if="engine === 'replicate'" href="https://replicate.com/collections/text-to-image" target="_blank">{{ t('settings.plugins.image.replicate.aboutModels') }}</a>
        </div>
      </div>
    </template>

  </div>
</template>

<script setup lang="ts">

import { ref, computed, nextTick } from 'vue'
import { store } from '@services/store'
import { t } from '@services/i18n'
import { baseURL as sdwebuiDefaultBaseURL } from '@services/sdwebui'
import ModelLoaderFactory from '@services/model_loader'
import Dialog from '@renderer/utils/dialog'
import ImageCreator from '@services/image'
import InputObfuscated from '@components/InputObfuscated.vue'
import OllamaModelPull from '@components/OllamaModelPull.vue'
import RefreshButton from '@components/RefreshButton.vue'
import Combobox from '@components/Combobox.vue'

const ollamaDefaultBaseURL = 'http://127.0.0.1:11434'

const ollamaImageModels = [
  { id: 'x/flux2-klein', name: 'Flux 2 Klein' },
  { id: 'x/z-image-turbo', name: 'Z Image Turbo' },
  { id: 'jmorgan/z-image-turbo', name: 'Z Image Turbo (jmorgan)' },
]

const enabled = ref(false)
const engine = ref(null)
const model = ref(null)
const huggingAPIKey = ref(null)
const replicateAPIKey = ref(null)
const falaiAPIKey = ref(null)
const sdwebuiBaseURL = ref('')
const ollamaBaseURL = ref('')

const engines = computed(() => ImageCreator.getEngines(false))
const models = computed(() => {
  // for ollama, use chat models since image generation is experimental
  if (engine.value === 'ollama') {
    return store.config.engines.ollama?.models?.chat || []
  }
  return store.config.engines[engine.value]?.models?.image || []
})

const load = () => {
  enabled.value = store.config.plugins.image.enabled || false
  engine.value = store.config.plugins.image.engine || 'openai'
  model.value = store.config.plugins.image.model || null
  huggingAPIKey.value = store.config.engines.huggingface?.apiKey || ''
  replicateAPIKey.value = store.config.engines.replicate?.apiKey || ''
  falaiAPIKey.value = store.config.engines.falai?.apiKey || ''
  sdwebuiBaseURL.value = store.config.engines.sdwebui?.baseURL || ''
  ollamaBaseURL.value = store.config.engines.ollama?.baseURL || ''
}

const onChangeEngine = async () => {
  await nextTick()
  model.value = models.value[0]?.id || ''
  save()
}

const getModels = async (): Promise<boolean> => {

  // do it
  let loader = ModelLoaderFactory.create(store.config, engine.value)
  let success = await loader.loadModels()
  if (!success) {
    Dialog.alert(t('common.errorModelRefresh'))
    return false
  }

  // reload
  load()

  // done
  return true

}

const save = () => {
  store.config.plugins.image.enabled = enabled.value
  store.config.plugins.image.engine = engine.value
  store.config.plugins.image.model = model.value
  store.config.engines.falai.apiKey = falaiAPIKey.value
  store.config.engines.huggingface.apiKey = huggingAPIKey.value
  store.config.engines.replicate.apiKey = replicateAPIKey.value
  store.config.engines.sdwebui.baseURL = sdwebuiBaseURL.value
  store.config.engines.ollama.baseURL = ollamaBaseURL.value
  store.saveSettings()
}

defineExpose({ load })

</script>

