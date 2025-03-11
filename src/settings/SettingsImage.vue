<template>
  <div>
    <div class="description">
      {{ t('settings.plugins.image.description') }}
    </div>
    <div class="group">
      <label>{{ t('common.enabled') }}</label>
      <input type="checkbox" v-model="enabled" @change="save" />
    </div>
    <div class="group">
      <label>{{ t('settings.plugins.image.provider') }}</label>
      <select v-model="engine" @change="onChangeEngine">
        <option v-for="engine in engines" :value="engine.id">{{ engine.name }}</option>
      </select>
    </div>
    <div class="group" v-if="engine == 'openai'">
      <label>{{ t('settings.plugins.image.imageModel') }}</label>
      <div class="subgroup">
        <select v-model="image_model" :disabled="image_models.length == 0" @change="save">
          <option v-for="model in image_models" :key="model.id" :value="model.id">{{ model.name }}
          </option>
        </select>
        <span>{{ t('settings.plugins.image.openai.apiKeyReminder') }}</span>
      </div>
      <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
    </div>
    <div class="group" v-if="engine == 'replicate'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="replicateAPIKey" @blur="save" />
    </div>
    <div class="group" v-if="engine == 'replicate'">
      <label>{{ t('settings.plugins.image.imageModel') }}</label>
      <div class="subgroup">
        <Combobox :items="replicate_models" :placeholder="t('settings.plugins.image.replicate.modelPlaceholder')" v-model="image_model" @change="save"/>
        <a href="https://replicate.com/collections/text-to-image" target="_blank">{{ t('settings.plugins.image.replicate.aboutModels') }}</a><br/>
      </div>
    </div>
    <div class="group" v-if="engine == 'huggingface'">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="huggingAPIKey" @blur="save" />
    </div>
    <div class="group" v-if="engine == 'huggingface'">
      <label>{{ t('settings.plugins.image.imageModel') }}</label>
      <div class="subgroup">
        <Combobox :items="hf_models" :placeholder="t('settings.plugins.image.huggingface.modelPlaceholder')" v-model="image_model" @change="save"/>
        <a href="https://huggingface.co/models?pipeline_tag=text-to-image&sort=likes" target="_blank">{{ t('settings.plugins.image.huggingface.aboutModels') }}</a><br/>
      </div>
    </div>
  </div>  
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import InputObfuscated from '../components/InputObfuscated.vue'
import Combobox from '../components/Combobox.vue'
import ImageCreator from '../services/image'
import LlmFactory from '../llms/llm'

const enabled = ref(false)
const engine = ref(null)
const huggingAPIKey = ref(null)
const replicateAPIKey = ref(null)
const refreshLabel = ref(t('common.refresh'))
const image_model = ref(null)
const image_models = ref([])

const engines = computed(() => ImageCreator.getEngines(false))

const hf_models = computed(() => ImageCreator.getModels('huggingface'))

const replicate_models = computed(() => ImageCreator.getModels('replicate'))

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
  refreshLabel.value = t('common.refreshing')
  setTimeout(() => getModels(), 500)
}

const setEphemeralRefreshLabel = (text: string) => {
  refreshLabel.value = text
  setTimeout(() => refreshLabel.value = t('common.refresh'), 2000)
}

const getModels = async () => {

  // load
  const llmFactory = new LlmFactory(store.config)
  let success = await llmFactory.loadModels('openai')
  if (!success) {
    image_models.value = []
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
