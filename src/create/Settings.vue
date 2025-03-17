<template>
  <div class="settings">
    <div class="title">{{ t('createMedia.title') }}</div>
    <form class="vertical">
        
      <div class="group media-type">
        <label>{{ t('createMedia.mediaType.label') }}</label>
        <select name="type" v-model="mediaType" @change="onChangeMediaType">
          <option value="image">{{ t('createMedia.mediaType.image') }}</option>
          <option value="video">{{ t('createMedia.mediaType.video') }}</option>
        </select>
      </div>

      <div class="group">
        <label>{{ t('createMedia.provider') }}</label>
        <select v-model="engine" name="engine" @change="onChangeEngine">
          <option v-for="engine in engines" :value="engine.id">{{ engine.name }}</option>
        </select>
      </div>

      <div class="group" v-if="hasFixedModels">
        <label>{{ t('createMedia.model') }}</label>
        <div class="subgroup">
          <select v-model="model" name="model" @change="onChangeModel">
            <option v-for="model in models" :value="model.id">{{ model.name }}</option>
          </select>
          <button @click.prevent="onRefresh">{{ refreshLabel }}</button>
        </div>
      </div>

      <div class="group" v-else>
        <label>{{ t('createMedia.model') }}</label>
        <ComboBox :items="models" v-model="model" @change="onChangeModel" />
        <a v-if="engine === 'replicate'" href="https://replicate.com/collections/text-to-image" target="_blank">{{ t('settings.plugins.image.replicate.aboutModels') }}</a>
        <a v-if="engine === 'huggingface'" href="https://huggingface.co/models?pipeline_tag=text-to-image&sort=likes" target="_blank">{{ t('settings.plugins.image.huggingface.aboutModels') }}</a>
      </div>

      <div class="group">
        <label>{{ t('common.prompt') }}</label>
        <textarea v-model="prompt" name="prompt" class="prompt" :placeholder="t('createMedia.promptPlaceholder')">
        </textarea>
      </div>

      <div v-if="modelHasParams" class="group">
        
        <label class="expander" @click="showParams = !showParams">
          <span>
            <span v-if="showParams" class="expand">▼</span>
            <span v-else class="expand">▶</span>
            {{ t('createMedia.parameters.title') }}
          </span>
        </label>

      </div>

      <template v-if="showParams">

        <div v-if="engine == 'replicate'" class="info"><a :href="`https://replicate.com/${model}`" target="_blank">{{ t('createMedia.moreAboutReplicateModels') }}</a></div>

        <div v-if="engine == 'huggingface'" class="info">{{ t('createMedia.parameters.supportWarning') }}</div>

        <div v-if="engine == 'sdwebui'" class="info"><a :href="`${new SDWebUI(store.config).baseUrl}/docs#/default/text2imgapi_sdapi_v1_txt2img_post`" target="_blank">{{ t('createMedia.moreAboutSDWebUIParameters') }}</a></div>
        
        <template v-if="modelHasCustomParams">
          <div class="group" v-for="param in customParams">
            <label>{{ param.label }}</label>
            <input v-if="param.type === 'input'" :name="`custom-${param.key}`" v-model="params[param.key]" type="text" />
            <textarea v-if="param.type === 'textarea'" :name="`custom-${param.key}`" v-model="params[param.key]"></textarea>
            <select v-if="param.type === 'select'" :name="`custom-${param.key}`" v-model="params[param.key]">
              <option value="">{{ t('common.default') }}</option>
              <option v-for="value in param.values" :value="value">{{ value }}</option>
            </select>
          </div>
        </template>

        <VariableTable v-if="modelHasUserParams" 
          :variables="params"
          :selectedVariable="selectedParam"
          @select="onSelectParam"
          @add="onAddParam"
          @edit="onEditParam"
          @delete="onDelParam"
        />

        <div v-if="modelHasParams" class="group">
          <label>{{ t('createMedia.modelDefaults') }}</label>
          <div class="subgroup">
            <button type="button" name="load" @click="onLoadDefaults" :disabled="!modelHasDefaults">{{ t('common.load') }}</button>
            <button type="button" name="save" @click="onSaveDefaults" :disabled="!canSaveAsDefaults">{{ t('common.save') }}</button>
            <button type="button" name="clear" @click="onClearDefaults" :disabled="!modelHasDefaults">{{ t('common.clear') }}</button>
          </div>
        </div>

      </template>

      <div class="group">
        <div class="subgroup">
          <button name="generate" class="generate-button" type="button" @click="generateMedia('create')" :disabled="isGenerating">
            {{ isGenerating ? t('createMedia.generating') : t('createMedia.generate') }}
          </button>
          <button v-if="canEdit" name="upload" type="button" @click="$emit('upload')" :disabled="isGenerating">{{ t('common.upload') }}</button>
          <button v-if="canEdit && hasCurrentImage" name="edit" type="button" @click="generateMedia('edit')" :disabled="isGenerating">{{ t('common.edit') }}</button>
        </div>
      </div>
    </form>

    <Teleport to="body">
      <VariableEditor ref="editor" title="createMedia.variableEditor.title" :variable="selectedParam" @save="onSaveParam" />
    </Teleport>

  </div>
</template>

<script setup lang="ts">

import { MediaCreator } from '../types/index'
import { onMounted, ref, Ref, computed } from 'vue'
import { t } from '../services/i18n'
import { store } from '../services/store'
import Dialog from '../composables/dialog'
import VariableEditor from '../screens/VariableEditor.vue'
import ComboBox from '../components/Combobox.vue'
import ImageCreator from '../services/image'
import VideoCreator from '../services/video'
import VariableTable from '../components/VariableTable.vue'
import SDWebUI from '../services/sdwebui'
import LlmFactory from '../llms/llm'

type Parameter = {
  label: string
  key: string
  type: string
  values?: string[]
}

defineProps({
  hasCurrentImage: {
    type: Boolean,
    default: false
  },
  isGenerating: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['upload', 'generate'])

const editor = ref(null)
const mediaType: Ref<'image'|'video'> = ref('image')
const engine = ref('')
const model = ref('')
const prompt = ref('')
const params: Ref<Record<string, string>> = ref({})
const showParams = ref(false)
const selectedParam = ref(null)
const refreshLabel = ref(t('common.refresh'))

const imageCreator = new ImageCreator()
const videoCreator = new VideoCreator()
const creator: Record<string, MediaCreator> = {
  image: imageCreator,
  video: videoCreator,
}

const hasFixedModels = computed(() => {
  return mediaType.value === 'image' && (['openai', 'google', 'sdwebui'].includes(engine.value))
})

const engines = computed(() => {
  return creator[mediaType.value].getEngines(true)
})

const models = computed(() => {
  if (hasFixedModels.value) {
    return store.config.engines[engine.value]?.models?.[mediaType.value] || []
  } else {
    return creator[mediaType.value].getModels(engine.value)
  }
})

const canEdit = computed(() => {
  return ['google'].includes(engine.value)
})

const modelHasDefaults = computed(() => {
  return store.config.create.defaults?.find((d) => d.engine === engine.value && d.model === model.value)
})

const canSaveAsDefaults = computed(() => {
  for (const key in params.value) {
    if (params.value[key]) {
      return true
    }
  }
  return false
})

const customParams = computed((): Parameter[] => {

  // openai dall-e-2
  if (engine.value === 'openai' && model.value === 'dall-e-2') {
    return [
      { label: t('createMedia.parameters.size'),  key: 'size',  type: 'select', values: [ '256x256', '512x512', '1024x1024' ] },
    ]
  }

  // openai dall-e-3
  if (engine.value === 'openai' && model.value === 'dall-e-3') {
    return [
      { label: t('createMedia.parameters.quality'),  key: 'quality',  type: 'select', values: [ 'standard', 'hd' ] },
      { label: t('createMedia.parameters.size'),  key: 'size',  type: 'select', values: [ '1024x1024', '1792x1024', '1024x1792' ] },
      { label: t('createMedia.parameters.style'),  key: 'style',  type: 'select', values: [ 'vivid', 'natural' ] },
    ]
  }

  // hugingface all models
  if (engine.value === 'huggingface') {
    return [
      { label: t('createMedia.parameters.negativePrompt'), key: 'negative_prompt', type: 'textarea' },
      { label: t('createMedia.parameters.width'),  key: 'width',  type: 'input' },
      { label: t('createMedia.parameters.height'), key: 'height', type: 'input' },
    ]
  }

  // // sdwebui all models
  // if (engine.value === 'sdwebui') {
  //   return [
  //     { label: t('createMedia.parameters.negativePrompt'), key: 'negative_prompt', type: 'textarea' },
  //     { label: t('createMedia.parameters.width'),  key: 'width',  type: 'input' },
  //     { label: t('createMedia.parameters.height'), key: 'height', type: 'input' },
  //   ]
  // }

  // default
  return []

})

const modelHasCustomParams = computed(() => {
  return customParams.value.length > 0
})

const modelHasUserParams = computed(() => {
  return ['replicate', 'sdwebui']. includes(engine.value)
})

const modelHasParams = computed(() => {
  return modelHasUserParams.value || modelHasCustomParams.value
})

onMounted(() => {
  mediaType.value = store.config.create.type || 'image'
  engine.value = store.config.create.engine || 'openai'
  model.value = store.config.create.model || 'dall-e-2'
  onLoadDefaults()
})

const onChangeMediaType = () => {
  engine.value = engines.value[0]?.id
  onChangeEngine()
}

const onChangeEngine = () => {
  model.value = models.value[0]?.id
  onChangeModel()
}

const onChangeModel = () => {
  onLoadDefaults()
  saveSettings()
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
    const llmFactory = new LlmFactory(store.config)
    let success = await llmFactory.loadModels(engine.value)
    if (!success) {
      setEphemeralRefreshLabel(t('common.error'))
      return
    }
  }

  // sdwebui
  if (engine.value == 'sdwebui') {
    const sdwebui = new SDWebUI(store.config)
    let success = await sdwebui.loadModels()
    if (!success) {
      setEphemeralRefreshLabel(t('common.error'))
      return
    }
  }

  // make sure we have a valid model
  if (!models.value.find((m) => m.id === model.value)) {
    model.value = models.value[0]?.id
  }

  // done
  setEphemeralRefreshLabel(t('common.done'))

}

const onSelectParam = (key: string) => {
  selectedParam.value = { key, value: params.value[key] }
}

const onAddParam = () => {
  selectedParam.value = { key: '', value: '' }
  editor.value.show()
}

const onDelParam = () => {
  if (selectedParam.value) {
    delete params.value[selectedParam.value.key]
    params.value = { ...params.value }
  }
}

const onEditParam = (key: string) => {
  selectedParam.value = { key, value: params.value[key] }
  editor.value.show()
}

const onSaveParam = (param: { key: string, value: string }) => {
  if (param.key.length) {
    if (param.key != selectedParam.value.key) {
      delete params.value[selectedParam.value.key]
    }
    params.value[param.key] = param.value
    params.value = { ...params.value }
  }
}

const onLoadDefaults = () => {
  const savedDefaults = store.config.create.defaults.find((d) => d.engine === engine.value && d.model === model.value)
  params.value = savedDefaults ? JSON.parse(JSON.stringify(savedDefaults?.params)) : {}
  if (Object.keys(params.value).length > 0) {
    showParams.value = true
  }
}

const onSaveDefaults = () => {
  onClearDefaults()
  store.config.create.defaults.push({
    engine: engine.value,
    model: model.value,
    params: params.value,
  })
  store.saveSettings()
}

const onClearDefaults = () => {
  store.config.create.defaults = store.config.create.defaults.filter((d) => d.engine !== engine.value || d.model !== model.value)
  store.saveSettings()
}

const loadSettings = (settings: any) => {
  mediaType.value = settings.mediaType || mediaType.value
  engine.value = settings.engine || engine.value
  model.value = settings.model || model.value
  prompt.value = settings.prompt || prompt.value
  params.value = settings.params || {}
  showParams.value = Object.keys(params.value).length > 0
  saveSettings()
}

const saveSettings = () => {
  store.config.create.type = mediaType.value
  store.config.create.engine = engine.value
  store.config.create.model = model.value
  store.saveSettings()
}

const generateMedia = async (action: 'create'|'edit') => {

  const userPrompt = prompt.value.trim()
  if (!userPrompt) {
    Dialog.show({
      title: t('common.error'),
      text: t('createMedia.error.promptRequired'),
    })
    return
  }

  emit('generate', {
    action: action,
    mediaType: mediaType.value,
    engine: engine.value,
    model: model.value,
    prompt: userPrompt,
    params: params.value
  })
}

defineExpose({
  loadSettings,
  generateMedia
})

</script>

<style scoped>
@import '../../css/form.css';
@import '../../css/list-with-actions.css';
@import '../../css/sticky-header-table.css';
@import '../../css/panel-content.css';
</style>

<style scoped>

.settings {
  overflow-y: auto;
  padding-bottom: 2rem;
}

.settings > * {
  padding: 0px 24px;
}

.settings form .group .subgroup {
  display: flex;
  width: 100%;
}

.settings form .group textarea {
  flex: auto;
  min-height: 2rem;
  height: 4rem;
  resize: vertical;
  background-color: var(--control-textarea-bg-color);
}

.settings .info {
  align-self: flex-start;
  margin-top: 0.25rem;
  margin-bottom: 0.5rem;
}

.settings .list-with-actions {
  margin-top: 0.5rem;
  width: 100%;
}

.settings form .group label.expander {
  margin-top: -0.5rem;
  cursor: pointer;
}

.settings .sticky-table-container {
  height: 100px;
}

.settings .sticky-table-container td {
  max-width: 60px;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.settings .error {
  color: red;
}

</style>