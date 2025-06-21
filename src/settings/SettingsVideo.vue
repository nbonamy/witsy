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

    <template v-if="engine == 'replicate'">
      <div class="group">
        <label>{{ t('settings.engines.apiKey') }}</label>
        <InputObfuscated v-model="replicateAPIKey" @blur="save" />
      </div>
      <div class="group">
        <label>{{ t('settings.plugins.video.videoModel') }}</label>
        <div class="subgroup">
          <Combobox :items="replicate_models" :placeholder="t('common.modelPlaceholder')" v-model="video_model" @change="save">
            <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
          </Combobox>
          <a href="https://replicate.com/collections/text-to-video" target="_blank">{{ t('settings.plugins.video.replicate.aboutModels') }}</a><br/>
        </div>
      </div>
    </template>
    
    <template v-if="engine == 'falai'">
      <div class="group">
        <label>{{ t('settings.engines.apiKey') }}</label>
        <InputObfuscated v-model="falaiAPIKey" @blur="save" />
      </div>
      <div class="group">
        <label>{{ t('settings.plugins.video.videoModel') }}</label>
        <div class="subgroup">
          <Combobox :items="falai_models" :placeholder="t('common.modelPlaceholder')" v-model="video_model" @change="save">
            <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
          </Combobox>
          <a href="https://fal.ai/models?categories=text-to-video" target="_blank">{{ t('settings.plugins.image.falai.aboutModels') }}</a><br/>
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
import VideoCreator from '../services/video'
import Falai from '../services/falai'
import Replicate from '../services/replicate'

const enabled = ref(false)
const engine = ref(null)
const replicateAPIKey = ref(null)
const falaiAPIKey = ref(null)
const refreshLabel = ref(t('common.refresh'))
const video_model = ref(null)

const engines = computed(() => VideoCreator.getEngines(false))
const replicate_models = computed(() => store.config.engines.replicate?.models?.video || [])
const falai_models = computed(() => store.config.engines.falai?.models?.video || [])

const load = () => {
  enabled.value = store.config.plugins.video.enabled || false
  engine.value = store.config.plugins.video.engine || 'replicate'
  replicateAPIKey.value = store.config.engines.replicate?.apiKey || ''
  falaiAPIKey.value = store.config.engines.falai?.apiKey || ''
  onChangeEngine()
}

const onChangeEngine = () => {
  video_model.value = store.config.plugins.video.model || ''
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

  // replicate
  if (engine.value === 'replicate') {
    const replicate = new Replicate(store.config)
    let success = await replicate.loadModels()
    if (!success) {
      Dialog.alert(t('common.errorModelRefresh'))
      setEphemeralRefreshLabel(t('common.error'))
      return
    }
  }

  // falai
  if (engine.value === 'falai') {
    const falai = new Falai(store.config)
    let success = await falai.loadModels()
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
  store.config.plugins.video.enabled = enabled.value
  store.config.plugins.video.engine = engine.value
  store.config.plugins.video.model = video_model.value
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
