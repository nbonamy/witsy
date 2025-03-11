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
        <select v-model="model" name="model" @change="onChangeModel">
          <option v-for="model in models" :value="model.id">{{ model.name }}</option>
        </select>
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

      <div v-if="engine === 'replicate'" class="group extra">
        <label @click="showParams = !showParams">
          <span>
            <span v-if="showParams" class="expand">▼</span>
            <span v-else class="expand">▶</span>
            {{ t('createMedia.parameters') }}
          </span>
        </label>
        <div v-if="showParams"><a :href="`https://replicate.com/${model}`" target="_blank">{{ t('createMedia.moreAboutReplicateModels') }}</a></div>
        <div v-if="showParams" class="list-with-actions">
          <VariableTable 
            :variables="params"
            :selectedVariable="selectedParam"
            @select="onSelectParam"
            @add="onAddParam"
            @edit="onEditParam"
            @delete="onDelParam"
          />
        </div>
      </div>
      <div v-if="showParams" class="group">
        <label>{{ t('createMedia.modelDefaults') }}</label>
        <div class="subgroup">
          <button type="button" name="load" @click="onLoadDefaults" :disabled="!modelHasDefaults">{{ t('common.load') }}</button>
          <button type="button" name="save" @click="onSaveDefaults" :disabled="!canSaveAsDefaults">{{ t('common.save') }}</button>
          <button type="button" name="clear" @click="onClearDefaults" :disabled="!modelHasDefaults">{{ t('common.clear') }}</button>
        </div>
      </div>

      <div class="group">
        <button name="generate" class="generate-button" type="button" @click="generateMedia" :disabled="isGenerating">
          {{ isGenerating ? t('createMedia.generating') : t('createMedia.generate') }}
        </button>
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

defineProps({
  isGenerating: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['generate'])

const editor = ref(null)
const mediaType: Ref<'image'|'video'> = ref('image')
const engine = ref('')
const model = ref('')
const prompt = ref('')
const params: Ref<Record<string, string>> = ref({})
const showParams = ref(false)
const selectedParam = ref(null)

const imageCreator = new ImageCreator()
const videoCreator = new VideoCreator()
const creator: Record<string, MediaCreator> = {
  image: imageCreator,
  video: videoCreator,
}

const hasFixedModels = computed(() => {
  return mediaType.value === 'image' && engine.value === 'openai'
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

const modelHasDefaults = computed(() => {
  return store.config.create.defaults?.find((d) => d.engine === engine.value && d.model === model.value)
})

const canSaveAsDefaults = computed(() => {
  return Object.keys(params.value).length > 0
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

const saveSettings = () => {
  store.config.create.type = mediaType.value
  store.config.create.engine = engine.value
  store.config.create.model = model.value
  store.saveSettings()
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

const generateMedia = async () => {

  const userPrompt = prompt.value.trim()
  if (!userPrompt) {
    Dialog.show({
      title: t('common.error'),
      text: t('createMedia.error.promptRequired'),
    })
    return
  }

  emit('generate', {
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
@import '../../css/dialog.css';
@import '../../css/list-with-actions.css';
@import '../../css/sticky-header-table.css';

.settings {
  flex: 1;
  scrollbar-color: var(--sidebar-scroll-thumb-color) var(--sidebar-bg-color);
  overflow-y: auto;
  padding-bottom: 2rem;
}

.settings > * {
  padding: 0px 24px;
}

.settings .title {
  font-weight: bold;
  font-size: 1.1em;
  color: var(--text-color);
  margin-bottom: 1rem;
}

.settings textarea.prompt {
  flex: auto;
  min-height: 2rem;
  height: 4rem;
  resize: vertical;
  background-color: var(--control-textarea-bg-color);
}

.settings .list-with-actions {
  margin-top: 0.5rem;
  width: 100%;
}

.settings .group.extra label {
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