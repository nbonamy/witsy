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
          <select v-model="image_model" :disabled="image_models.length == 0" @change="save">
            <option v-for="model in image_models" :key="model.id" :value="model.id">{{ model.name }}
            </option>
          </select>
          <span>{{ t('settings.plugins.image.apiKeyReminder') }}</span>
        </div>
        <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
      </div>
    </template>

    <template v-if="engine == 'replicate'">
      <div class="group">
        <label>{{ t('settings.engines.apiKey') }}</label>
        <InputObfuscated v-model="replicateAPIKey" @blur="save" />
      </div>
      <div class="group">
        <label>{{ t('settings.plugins.image.imageModel') }}</label>
        <div class="subgroup">
          <Combobox :items="replicate_models" :placeholder="t('common.modelPlaceholder')" v-model="image_model" @change="save"/>
          <a href="https://replicate.com/collections/text-to-image" target="_blank">{{ t('settings.plugins.image.replicate.aboutModels') }}</a><br/>
        </div>
      </div>
    </template>

    <template v-if="engine == 'falai'">
      <div class="group">
        <label>{{ t('settings.engines.apiKey') }}</label>
        <InputObfuscated v-model="falaiAPIKey" @blur="save" />
      </div>
      <div class="group">
        <label>{{ t('settings.plugins.image.imageModel') }}</label>
        <div class="subgroup">
          <Combobox :items="falai_models" :placeholder="t('common.modelPlaceholder')" v-model="image_model" @change="save"/>
          <a href="https://fal.ai/models?categories=text-to-image" target="_blank">{{ t('settings.plugins.image.falai.aboutModels') }}</a><br/>
        </div>
      </div>
    </template>

    <template v-if="engine == 'huggingface'">
      <div class="group">
        <label>{{ t('settings.engines.apiKey') }}</label>
        <InputObfuscated v-model="huggingAPIKey" @blur="save" />
      </div>
      <div class="group">
        <label>{{ t('settings.plugins.image.imageModel') }}</label>
        <div class="subgroup">
          <Combobox :items="hf_models" :placeholder="t('common.modelPlaceholder')" v-model="image_model" @change="save"/>
          <a href="https://huggingface.co/models?pipeline_tag=text-to-image&sort=likes" target="_blank">{{ t('settings.plugins.image.huggingface.aboutModels') }}</a><br/>
        </div>
      </div>
    </template>

    <template v-if="engine == 'sdwebui'">
      <div class="group">
        <label>{{ t('settings.engines.sdwebui.baseURL') }}</label>
        <div class="subgroup">
          <input type="text" v-model="sdwebuiBaseURL" :placeholder="sdwebuiDefaultBaseURL" @blur="save" />
          <a href="https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/API" target="_blank">{{ t('settings.engines.sdwebui.ensureApiMode') }}</a>
        </div>
      </div>
      <div class="group">
        <label>{{ t('settings.plugins.image.imageModel') }}</label>
        <select v-model="image_model" :disabled="image_models.length == 0" @change="save">
          <option v-for="model in image_models" :key="model.id" :value="model.id">{{ model.name }}
          </option>
        </select>
        <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
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
import SDWebUI, { baseURL as sdwebuiDefaultBaseURL } from '../services/sdwebui'
import LlmFactory, { ILlmManager } from '../llms/llm'

const enabled = ref(false)
const engine = ref(null)
const huggingAPIKey = ref(null)
const replicateAPIKey = ref(null)
const falaiAPIKey = ref(null)
const sdwebuiBaseURL = ref('')
const refreshLabel = ref(t('common.refresh'))
const image_model = ref(null)
const image_models = ref([])

const engines = computed(() => ImageCreator.getEngines(false))

const hf_models = computed(() => ImageCreator.getModels('huggingface'))
const falai_models = computed(() => ImageCreator.getModels('falai'))
const replicate_models = computed(() => ImageCreator.getModels('replicate'))

const load = () => {
  enabled.value = store.config.plugins.image.enabled || false
  engine.value = store.config.plugins.image.engine || 'openai'
  huggingAPIKey.value = store.config.engines.huggingface?.apiKey || ''
  replicateAPIKey.value = store.config.engines.replicate?.apiKey || ''
  falaiAPIKey.value = store.config.engines.falai?.apiKey || ''
  sdwebuiBaseURL.value = store.config.engines.sdwebui?.baseURL || ''
  onChangeEngine()
}

const onChangeEngine = () => {
  image_models.value = store.config.engines[engine.value]?.models?.image || []
  image_model.value = store.config.engines[engine.value]?.model?.image || ''
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

  // openai
  if (engine.value === 'openai' || engine.value === 'google') {
    const llmManager = LlmFactory.manager(store.config)
    let success = await llmManager.loadModels(engine.value)
    if (!success) {
      Dialog.alert(t('common.errorModelRefresh'))
      setEphemeralRefreshLabel(t('common.error'))
      return
    }
  }

  // sdwebui
  if (engine.value == 'sdwebui') {
    const sdwebui = new SDWebUI(store.config)
    let success = await sdwebui.loadModels()
    if (!success) {
      Dialog.alert(t('common.errorModelRefresh'))
      setEphemeralRefreshLabel(t('common.error'))
      return
    }
  }

  // reload
  load()

  // done
  setEphemeralRefreshLabel(t('common.done'))

}

const save = () => {
  store.config.plugins.image.enabled = enabled.value
  store.config.plugins.image.engine = engine.value
  store.config.engines.huggingface.apiKey = huggingAPIKey.value
  store.config.engines.replicate.apiKey = replicateAPIKey.value
  store.config.engines.falai.apiKey = falaiAPIKey.value
  store.config.engines[engine.value].model.image = image_model.value
  store.config.engines.sdwebui.baseURL = sdwebuiBaseURL.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>
