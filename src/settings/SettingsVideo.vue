<template>
  <div class="form form-vertical form-large">
    
    <div class="description">
      {{ t('settings.plugins.video.description') }}
    </div>
    
    <div class="form-field horizontal">
      <input type="checkbox" id="video-enabled" v-model="enabled" @change="save" />
      <label for="video-enabled">{{ t('common.enabled') }}</label>
    </div>
    
    <div class="form-field">
      <label>{{ t('settings.plugins.video.provider') }}</label>
      <select v-model="engine" @change="onChangeEngine">
        <option v-for="engine in engines" :value="engine.id">{{ engine.name }}</option>
      </select>
    </div>

    <div class="form-field" v-if="['falai', 'replicate'].includes(engine)">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-if="engine === 'falai'" v-model="falaiAPIKey" @blur="save" />
      <InputObfuscated v-if="engine === 'replicate'" v-model="replicateAPIKey" @blur="save" />
    </div>

    <div class="form-field">
      <label>{{ t('settings.plugins.video.videoModel') }}</label>
      <div class="form-subgroup">
        <Combobox :items="models" :placeholder="t('common.modelPlaceholder')" v-model="model" @change="save">
          <RefreshButton :on-refresh="getModels" />
        </Combobox>
        <a v-if="engine === 'replicate'" href="https://replicate.com/collections/text-to-video" target="_blank">{{ t('settings.plugins.video.replicate.aboutModels') }}</a>
        <a v-if="engine === 'falai'" href="https://fal.ai/models?categories=text-to-video" target="_blank">{{ t('settings.plugins.video.falai.aboutModels') }}</a>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">

import { ref, computed, nextTick } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import RefreshButton from '../components/RefreshButton.vue'
import InputObfuscated from '../components/InputObfuscated.vue'
import Combobox from '../components/Combobox.vue'
import VideoCreator from '../services/video'
import ModelLoaderFactory from '../services/model_loader'

const enabled = ref(false)
const engine = ref(null)
const model = ref(null)
const replicateAPIKey = ref(null)
const falaiAPIKey = ref(null)

const engines = computed(() => VideoCreator.getEngines(false))
const models = computed(() => store.config.engines[engine.value]?.models?.video || [])

const load = () => {
  enabled.value = store.config.plugins.video.enabled || false
  engine.value = store.config.plugins.video.engine || 'replicate'
  model.value = store.config.plugins.video.model || ''
  replicateAPIKey.value = store.config.engines.replicate?.apiKey || ''
  falaiAPIKey.value = store.config.engines.falai?.apiKey || ''
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
  store.config.plugins.video.enabled = enabled.value
  store.config.plugins.video.engine = engine.value
  store.config.plugins.video.model = model.value
  store.config.engines.replicate.apiKey = replicateAPIKey.value
  store.config.engines.falai.apiKey = falaiAPIKey.value
  store.saveSettings()
}

defineExpose({ load })

</script>

