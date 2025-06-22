<template>
  <div>
    
    <div class="description">
      {{ t('settings.plugins.video.description') }}
    </div>
    
    <div class="group horizontal">
      <input type="checkbox" v-model="enabled" @change="save" />
      <label>{{ t('common.enabled') }}</label>
    </div>
    
    <div class="group">
      <label>{{ t('settings.plugins.video.provider') }}</label>
      <select v-model="engine" @change="onChangeEngine">
        <option v-for="engine in engines" :value="engine.id">{{ engine.name }}</option>
      </select>
    </div>

    <div class="group">
      <label>{{ t('settings.engines.apiKey') }}</label>
      <InputObfuscated v-model="apiKey" @blur="save" />
    </div>
    <div class="group">
      <label>{{ t('settings.plugins.video.videoModel') }}</label>
      <div class="subgroup">
        <Combobox :items="models" :placeholder="t('common.modelPlaceholder')" v-model="model" @change="save">
          <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
        </Combobox>
        <a v-if="engine === 'replicate'" href="https://replicate.com/collections/text-to-video" target="_blank">{{ t('settings.plugins.video.replicate.aboutModels') }}</a>
        <a v-if="engine === 'falai'" href="https://fal.ai/models?categories=text-to-video" target="_blank">{{ t('settings.plugins.video.falai.aboutModels') }}</a>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { store } from '../services/store'
import { t } from '../services/i18n'
import Dialog from '../composables/dialog'
import InputObfuscated from '../components/InputObfuscated.vue'
import Combobox from '../components/Combobox.vue'
import VideoCreator from '../services/video'
import ModelLoaderFactory from '../services/model_loader'

const enabled = ref(false)
const engine = ref(null)
const model = ref(null)
const replicateAPIKey = ref(null)
const falaiAPIKey = ref(null)
const refreshLabel = ref(t('common.refresh'))

const engines = computed(() => VideoCreator.getEngines(false))
const models = computed(() => store.config.engines[engine.value]?.models?.video || [])

const apiKey = computed({

  get() {
    if (engine.value === 'replicate') {
      return replicateAPIKey.value
    } else if (engine.value === 'falai') {
      return falaiAPIKey.value
    }
    return null
  },
  set(value) {
    if (engine.value === 'replicate') {
      replicateAPIKey.value = value
    } else if (engine.value === 'falai') {
      falaiAPIKey.value = value
    }
  }

})

const load = () => {
  enabled.value = store.config.plugins.video.enabled || false
  engine.value = store.config.plugins.video.engine || 'replicate'
  replicateAPIKey.value = store.config.engines.replicate?.apiKey || ''
  falaiAPIKey.value = store.config.engines.falai?.apiKey || ''
  model.value = store.config.plugins.video.model || ''
  onChangeEngine()
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
  store.config.plugins.video.enabled = enabled.value
  store.config.plugins.video.engine = engine.value
  store.config.plugins.video.model = model.value
  store.config.engines.replicate.apiKey = replicateAPIKey.value
  store.config.engines.falai.apiKey = falaiAPIKey.value
  store.saveSettings()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
@import '../../css/form.css';
</style>
