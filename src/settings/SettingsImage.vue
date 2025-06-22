<template>
  <div>

    <div class="description">
      {{ t('settings.plugins.image.description') }}
    </div>

    <div class="group horizontal">
      <input type="checkbox" v-model="enabled" @change="save" />
      <label>{{ t('common.enabled') }}</label>
    </div>

    <div class="group">
      <label>{{ t('settings.plugins.image.provider') }}</label>
      <select v-model="engine" @change="onChangeEngine">
        <option v-for="engine in engines" :value="engine.id">{{ engine.name }}</option>
      </select>
    </div>

    <template v-if="['openai', 'google', 'xai'].includes(engine)">
      <div class="group">
        <label>{{ t('settings.plugins.image.imageModel') }}</label>
        <div class="subgroup">
          <div class="control-group">
            <select v-model="model" :disabled="models.length == 0" @change="save">
              <option v-for="model in models" :key="model.id" :value="model.id">{{ model.name }}
              </option>
            </select>
            <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
          </div>
          <span>{{ t('settings.plugins.image.apiKeyReminder') }}</span>
        </div>
      </div>
    </template>

    <template v-else-if="engine == 'sdwebui'">
      <div class="group">
        <label>{{ t('settings.engines.sdwebui.baseURL') }}</label>
        <div class="subgroup">
          <input type="text" v-model="sdwebuiBaseURL" :placeholder="sdwebuiDefaultBaseURL" @blur="save" />
          <a href="https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/API" target="_blank">{{ t('settings.engines.sdwebui.ensureApiMode') }}</a>
        </div>
      </div>
      <div class="group">
        <label>{{ t('settings.plugins.image.imageModel') }}</label>
        <div class="control-group">
          <select v-model="model" :disabled="models.length == 0" @change="save">
            <option v-for="model in models" :key="model.id" :value="model.id">{{ model.name }}
            </option>
          </select>
          <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="group">
        <label>{{ t('settings.engines.apiKey') }}</label>
        <InputObfuscated v-model="apiKey" @blur="save" />
      </div>
      <div class="group">
        <label>{{ t('settings.plugins.image.imageModel') }}</label>
        <div class="subgroup">
          <Combobox :items="models" :placeholder="t('common.modelPlaceholder')" v-model="model" @change="save">
            <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
          </Combobox>
          <a v-if="engine === 'replicate'" href="https://replicate.com/collections/text-to-image" target="_blank">{{ t('settings.plugins.image.replicate.aboutModels') }}</a>
          <a v-if="engine === 'falai'" href="https://fal.ai/models?categories=text-to-image" target="_blank">{{ t('settings.plugins.image.falai.aboutModels') }}</a>
          <a v-if="engine === 'huggingface'" href="https://huggingface.co/models?pipeline_tag=text-to-image&sort=likes" target="_blank">{{ t('settings.plugins.image.huggingface.aboutModels') }}</a>
        </div>
      </div>
    </template>

  </div>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import InputObfuscated from '../components/InputObfuscated.vue'
import Combobox from '../components/Combobox.vue'
import ImageCreator from '../services/image'
import { baseURL as sdwebuiDefaultBaseURL } from '../services/sdwebui'
import ModelLoaderFactory from '../services/model_loader'

const enabled = ref(false)
const engine = ref(null)
const model = ref(null)
const huggingAPIKey = ref(null)
const replicateAPIKey = ref(null)
const falaiAPIKey = ref(null)
const sdwebuiBaseURL = ref('')
const refreshLabel = ref(t('common.refresh'))

const engines = computed(() => ImageCreator.getEngines(false))
const models = computed(() => store.config.engines[engine.value]?.models?.image || [])

const apiKey = computed({

  get() {
    if (engine.value === 'huggingface') {
      return huggingAPIKey.value
    } else if (engine.value === 'replicate') {
      return replicateAPIKey.value
    } else if (engine.value === 'falai') {
      return falaiAPIKey.value
    } else if (engine.value === 'sdwebui') {
      return sdwebuiBaseURL.value
    }
    return null
  },
  set(value) {
    if (engine.value === 'huggingface') {
      huggingAPIKey.value = value
    } else if (engine.value === 'replicate') {
      replicateAPIKey.value = value
    } else if (engine.value === 'falai') {
      falaiAPIKey.value = value
    } else if (engine.value === 'sdwebui') {
      sdwebuiBaseURL.value = value
    }
  }

})

const load = () => {
  enabled.value = store.config.plugins.image.enabled || false
  engine.value = store.config.plugins.image.engine || 'openai'
  huggingAPIKey.value = store.config.engines.huggingface?.apiKey || ''
  replicateAPIKey.value = store.config.engines.replicate?.apiKey || ''
  falaiAPIKey.value = store.config.engines.falai?.apiKey || ''
  sdwebuiBaseURL.value = store.config.engines.sdwebui?.baseURL || ''
  model.value = store.config.plugins.image.model || null
}

const onChangeEngine = () => {
  model.value = models.value[0]?.id || ''
  save()
}

const onRefresh = async () => {
  refreshLabel.value = t('common.refreshing')
  setTimeout(() => getModels(), 500)
}

const setEphemeralRefreshLabel = (text: string) => {
  refreshLabel.value = text
  setTimeout(() => refreshLabel.value = t('common.refresh'), 2000)
}

const getModels = async () => {

  // do it
  let loader = ModelLoaderFactory.create(store.config, engine.value)
  let success = await loader.loadModels()
  if (!success) {
    Dialog.alert(t('common.errorModelRefresh'))
    setEphemeralRefreshLabel(t('common.error'))
    return
  }

  // reload
  load()

  // done
  setEphemeralRefreshLabel(t('common.done'))

}

const save = () => {
  store.config.plugins.image.enabled = enabled.value
  store.config.plugins.image.engine = engine.value
  store.config.plugins.image.model = model.value
  store.config.engines.falai.apiKey = falaiAPIKey.value
  store.config.engines.huggingface.apiKey = huggingAPIKey.value
  store.config.engines.replicate.apiKey = replicateAPIKey.value
  store.config.engines.sdwebui.baseURL = sdwebuiBaseURL.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>
