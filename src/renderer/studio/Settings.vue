<template>
  <div class="studio-settings">
    <main>
    <div class="form form-large form-vertical">

      <div class="form-field media-type">
        <label>{{ t('designStudio.mediaType.label') }}</label>
        <select name="type" v-model="mediaType" @change="onChangeMediaType">
          <option value="image">{{ t('designStudio.mediaType.image') }}</option>
          <option value="video">{{ t('designStudio.mediaType.video') }}</option>
        </select>
      </div>

      <div class="form-field">
        <label>{{ t('designStudio.provider') }}</label>
        <select v-model="engine" name="engine" @change="onChangeEngine">
          <option v-for="engine in engines" :value="engine.id">{{ engine.name }}</option>
        </select>
      </div>

      <div class="form-field">
        
        <label>{{ t('designStudio.model') }}</label>

        <template v-if="allowModelEntry">
          <ComboBox name="model" :items="models" v-model="model" @change="onChangeModel">
            <button name="favorite" @click.prevent="toggleFavorite">
              <StarOffIcon v-if="isFavorite"/>
              <StarIcon v-else/>
            </button>
          </ComboBox>
          <RefreshButton :on-refresh="getModels" />
          <a v-if="engine === 'falai'" :href="falaiModelsLink" target="_blank">{{ t('settings.plugins.image.falai.aboutModels') }}</a>
          <a v-if="engine === 'replicate'" :href="replicateModelsLink" target="_blank">{{ t('settings.plugins.image.replicate.aboutModels' ) }}</a>
          <a v-if="engine === 'huggingface'" href="https://huggingface.co/models?pipeline_tag=text-to-image&sort=likes" target="_blank">{{ t('settings.plugins.image.huggingface.aboutModels') }}</a>
        </template>

        <template v-else>
          <div class="form-subgroup">
            <select v-model="model" name="model" @change="onChangeModel">
              <option v-for="model in models" :value="model.id">{{ model.name }}</option>
            </select>
            <RefreshButton :on-refresh="getModels" />
          </div>
        </template>
      
      </div>

      <div class="form-field" v-if="canUpload">
        <label>{{ t('designStudio.inputImage') }}</label>
        <div class="form-subgroup">
          <button name="upload" type="button" @click="$emit('upload')" :disabled="isGenerating"><UploadIcon />{{ t('common.upload') }}</button>
          <button name="draw" type="button" @click="$emit('draw')" :disabled="isGenerating"><LineSquiggleIcon />{{ t('designStudio.draw') }}</button>
        </div>
      </div>

      <div class="form-field horizontal" v-if="currentMedia != null && canTransform">
        <input type="checkbox" id="studio-transform" v-model="transform" name="transform" @change="onChangeTransform"/>
        <label for="studio-transform">{{ t('designStudio.transform') }}</label>
      </div>

      <div class="form-field horizontal" v-if="isEditing && !isGenerating">
        <input type="checkbox" id="studio-preserve" v-model="preserve" name="preserve" />
        <label for="studio-preserve">{{ t('designStudio.preserveOriginal') }}</label>
      </div>

      <div class="form-field">
        <label>{{ t('common.prompt') }}<WandIcon v-if="promptLibrary.length" @click="onShowPromptLibrary"/></label>
        <textarea v-model="prompt" name="prompt" class="prompt" :placeholder="t('designStudio.promptPlaceholder')">
        </textarea>
        <div class="attachments" v-if="attachments.length">
          <div v-for="attachment in attachments" :key="attachment.url" class="attachment">
            <AttachmentView :attachment="attachment" />
            <div class="title" v-if="!attachment.isImage()">{{ attachment.filenameShort }}</div>
            <XIcon class="delete" @click="onDetach(attachment)" />
          </div>
        </div>
        <button v-if="canAttach" name="attach" type="button" @click="onAttach" :disabled="isGenerating"><PaperclipIcon />{{ t('common.attach') }}</button>
      </div>

      <div v-if="modelHasParams" class="form-field">
        
        <label class="expander" @click="showParams = !showParams">
          <span>
            <span v-if="showParams" class="expand">▼</span>
            <span v-else class="expand">▶</span>
            {{ t('designStudio.parameters.title') }}
          </span>
        </label>

      </div>

      <template v-if="showParams">

        <div v-if="engine == 'replicate'" class="info"><a :href="`https://replicate.com/${model.split(':')[0]}`" target="_blank">{{ t('designStudio.moreAboutModelParameters') }}</a></div>
        <div v-if="engine == 'falai'" class="info"><a :href="`https://fal.ai/models//${model.split(':')[0]}`" target="_blank">{{ t('designStudio.moreAboutModelParameters') }}</a></div>
        <div v-if="engine == 'huggingface'" class="info">{{ t('designStudio.parameters.supportWarning') }}</div>
        <div v-if="engine == 'sdwebui'" class="info"><a :href="`${SDWebUIBaseURL}/docs#/default/text2imgapi_sdapi_v1_txt2img_post`" target="_blank">{{ t('designStudio.moreAboutSDWebUIParameters') }}</a></div>
        
        <template v-if="modelHasCustomParams">
          <div class="form-field" v-for="param in customParams">
            <label>{{ param.label }}</label>
            <input v-if="param.type === 'input'" :name="`custom-${param.key}`" v-model="params[param.key]" type="text" />
            <textarea v-if="param.type === 'textarea'" :name="`custom-${param.key}`" v-model="params[param.key]"></textarea>
            <select v-if="param.type === 'select'" :name="`custom-${param.key}`" v-model="params[param.key]">
              <option value="">{{ t('common.default') }}</option>
              <option v-for="value in param.values" :value="value">{{ value }}</option>
            </select>
          </div>
        </template>

        <div v-if="currentMedia != null && transform">
          {{ t('designStudio.parameters.replicateInputImage') }}
        </div>

        <VariableTable v-if="modelHasUserParams" 
          :variables="params"
          :selectedVariable="selectedParam"
          @select="onSelectParam"
          @add="onAddParam"
          @edit="onEditParam"
          @delete="onDelParam"
        />

        <div v-if="modelHasParams" class="form-field">
          <label>{{ t('designStudio.modelDefaults') }}</label>
          <div class="form-subgroup">
            <button type="button" name="load" @click="onLoadDefaults" :disabled="!modelHasDefaults">{{ t('common.load') }}</button>
            <button type="button" name="save" @click="onSaveDefaults" :disabled="!canSaveAsDefaults">{{ t('common.save') }}</button>
            <button type="button" name="clear" @click="onClearDefaults" :disabled="!modelHasDefaults">{{ t('common.clear') }}</button>
          </div>
        </div>

      </template>

    </div>
    </main>
    
    <footer>
      <button name="generate" class="cta" type="button" @click="generateMedia()" :disabled="isGenerating">
        <BrushIcon />
        {{ isGenerating ? t('designStudio.generating') : isEditing ? t('common.edit') : t('designStudio.generate') }}
      </button>
    </footer>

    <VariableEditor ref="editor" id="studio-variable-editor" title="designStudio.variableEditor.title" :variable="selectedParam" @save="onSaveParam" />

    <ContextMenuPlus v-if="showPromptLibrary" :mouseX="menuX" :mouseY="menuY" @close="showPromptLibrary = false">
      <div v-for="item in promptLibrary" :key="item.action" class="item" @click="onRunPromptLibrary(item.action)">
        {{ item.label }}
      </div>
    </ContextMenuPlus>

  </div>
</template>

<script setup lang="ts">

import { BrushIcon, LineSquiggleIcon, PaperclipIcon, StarIcon, StarOffIcon, UploadIcon, WandIcon, XIcon } from 'lucide-vue-next'
import { Model } from 'multi-llm-ts'
import { FileContents } from 'types/file'
import { DesignStudioMediaType, MediaCreator } from 'types/index'
import { computed, onMounted, ref, watch } from 'vue'
import Attachment from '@models/attachment'
import Message from '@models/message'
import AttachmentView from '@components/Attachment.vue'
import ComboBox from '@components/Combobox.vue'
import ContextMenuPlus from '@components/ContextMenuPlus.vue'
import RefreshButton from '@components/RefreshButton.vue'
import VariableTable from '@components/VariableTable.vue'
import Dialog from '@renderer/utils/dialog'
import VariableEditor from '@screens/VariableEditor.vue'
import { t } from '@services/i18n'
import ImageCreator from '@services/image'
import ModelLoaderFactory from '@services/model_loader'
import { baseURL as SDWebUIBaseURL } from '@services/sdwebui'
import { kReferenceParamValue, store } from '@services/store'
import VideoCreator from '@services/video'
import promptsLibrary from './prompts.json'

type Parameter = {
  label: string
  key: string
  type: string
  values?: string[]
}

const props = defineProps({
  currentMedia: {
    type: Message,
    default: false
  },
  isGenerating: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['upload', 'generate', 'draw'])

const editor = ref(null)
const mediaType= ref<DesignStudioMediaType>('image')
const engine = ref('')
const model = ref('')
const prompt = ref('')
const attachments = ref<Attachment[]>([])
const params = ref<Record<string, string>>({})
const transform = ref(false)
const preserve = ref(false)
const showParams = ref(false)
const selectedParam = ref(null)
const showPromptLibrary = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const imageCreator = new ImageCreator()
const videoCreator = new VideoCreator()
const creator: Record<string, MediaCreator> = {
  image: imageCreator,
  video: videoCreator,
}

const modelType = computed((): DesignStudioMediaType => {
  return mediaType.value + (transform.value ? 'Edit' : '') as DesignStudioMediaType
})

const engines = computed(() => {
  return creator[mediaType.value].getEngines(true).sort((a, b) => a.name.localeCompare(b.name))
})

const hasFixedModels = computed(() => {
  return (mediaType.value === 'image' && (['openai', 'google', 'sdwebui', 'xai'].includes(engine.value)))
})

const allowModelEntry = computed(() => {
  return ['replicate', 'falai', 'sdwebui', 'huggingface' ].includes(engine.value)
})

const promptLibrary = computed((): any => {

  // for typing
  let prompts = []
  const library = promptsLibrary as Record<string, { label: string, prompt: string, enabled?: boolean }[]>
  
  // dynamic build ids
  const transformType = transform.value ? 'edit' : 'create'
  const genericId = `${mediaType.value}-${transformType}`
  const engineId = `${engine.value}-${genericId}`
  if (library[genericId]) {
    prompts.push(...library[genericId])
  }
  if (library[engineId]) {
    prompts.push(...library[engineId])
  }

  // filter and map
  return prompts.filter(p => p.enabled ?? true).map((p) => ({ ...p, action: p.label }))

})

const addCurrentModel = (models: Model[]): Model[] => {
  if (model.value) {
    const currentModel = models.find((m) => m.id === model.value)
    if (!currentModel) {
      models.unshift({ id: model.value, name: model.value })
    }
  }
  return models
}

const models = computed(() => {
  
  // if we have a specific list then return it
  if (store.config.engines[engine.value]?.models?.[modelType.value]?.length) {
    return addCurrentModel([
      ...store.config.studio.favorites.filter((f) => f.engine === engine.value).map((f) => ({ id: f.model, name: f.model })),
      ...store.config.engines[engine.value].models[modelType.value]
    ])
  }

  if (hasFixedModels.value) {

    // load models for the media type
    let models = store.config.engines[engine.value]?.models?.[mediaType.value] || []

    // for openai custom base url fallback to chat models if no models are found for the media type
    if (!models.length && engine.value === 'openai' && store.config.engines.openai.baseURL) {
      models = store.config.engines[engine.value]?.models?.chat || []
    }

    // done
    return models

  } else {

    // for ollama fallback to chat models if no models are found for the media type
    let models = store.config.engines[engine.value]?.models?.[mediaType.value] || []
    if (!models.length && ['ollama'].includes(engine.value)) {
      models = store.config.engines[engine.value]?.models?.chat || []
    }

    return addCurrentModel([
      ...store.config.studio.favorites.filter((f) => f.engine === engine.value).map((f) => ({ id: f.model, name: f.model })),
      ...store.config.studio.defaults.filter((d) => d.engine === engine.value).map((d) => ({ id: d.model, name: d.model })),
      ...models
    ])
  }
})

const canEdit = computed(() => {
  return (engine.value === 'openai' && !model.value.includes('dall-e'))
})

const canAttach = computed(() => {
  return engine.value === 'google' && (model.value.includes('-image') || model.value.includes('nano-banana') )
})

const modelHasDefaults = computed(() => {
  return store.config.studio.defaults?.find((d) => d.engine === engine.value && d.model === model.value)
})

const canSaveAsDefaults = computed(() => {
  for (const key in params.value) {
    if (params.value[key]) {
      return true
    }
  }
  return false
})

const onAttach = () => {
  let file = window.api.file.pickFile({ filters: [
    { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] }
  ] })
  if (file) {
    const fileContents = file as FileContents
    attachments.value.push(new Attachment(fileContents.contents, fileContents.mimeType, fileContents.url))
  }
}

const onDetach = (attachment: Attachment) => {
  attachments.value = attachments.value.filter((a: Attachment) => a !== attachment)
}

const customParams = computed((): Parameter[] => {

  // openai dall-e-2
  if (engine.value === 'openai' && model.value === 'dall-e-2') {
    return [
      { label: t('designStudio.parameters.size'),  key: 'size',  type: 'select', values: [ '256x256', '512x512', '1024x1024' ] },
    ]
  }

  // openai dall-e-3
  if (engine.value === 'openai' && model.value === 'dall-e-3') {
    return [
      { label: t('designStudio.parameters.quality'),  key: 'quality',  type: 'select', values: [ 'standard', 'hd' ] },
      { label: t('designStudio.parameters.size'),  key: 'size',  type: 'select', values: [ '1024x1024', '1792x1024', '1024x1792' ] },
      { label: t('designStudio.parameters.style'),  key: 'style',  type: 'select', values: [ 'vivid', 'natural' ] },
    ]
  }

  // openai gpt-image
  if (engine.value === 'openai' && model.value && model.value.startsWith('gpt-image-')) {
    return [
    { label: t('designStudio.parameters.quality'),  key: 'quality',  type: 'select', values: [ 'auto', 'low', 'medium', 'high' ] },
    { label: t('designStudio.parameters.size'),  key: 'size',  type: 'select', values: [ 'auto', '1024x1024', '1536x1024', '1024x1536' ] },
    ]
  }

  // // fal.ai images
  // if (engine.value === 'falai' && mediaType.value === 'image') {
  //   return [
  //     { label: t('designStudio.parameters.size'),  key: 'image_size',  type: 'select', values: [
  //       'square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9'
  //     ] },
  //     { label: t('designStudio.parameters.style'),  key: 'style',  type: 'select', values: [
  //       'realistic_image', 'digital_illustration', 'vector_illustration', 'realistic_image/b_and_w',
  //       'realistic_image/hard_flash', 'realistic_image/hdr', 'realistic_image/natural_light',
  //       'realistic_image/studio_portrait', 'realistic_image/enterprise', 'realistic_image/motion_blur',
  //       'realistic_image/evening_light', 'realistic_image/faded_nostalgia', 'realistic_image/forest_life',
  //       'realistic_image/mystic_naturalism', 'realistic_image/natural_tones', 'realistic_image/organic_calm',
  //       'realistic_image/real_life_glow', 'realistic_image/retro_realism', 'realistic_image/retro_snapshot',
  //       'realistic_image/urban_drama', 'realistic_image/village_realism', 'realistic_image/warm_folk',
  //       'digital_illustration/pixel_art', 'digital_illustration/hand_drawn', 'digital_illustration/grain',
  //       'digital_illustration/infantile_sketch', 'digital_illustration/2d_art_poster', 'digital_illustration/handmade_3d',
  //       'digital_illustration/hand_drawn_outline', 'digital_illustration/engraving_color',
  //       'digital_illustration/2d_art_poster_2', 'digital_illustration/antiquarian', 'digital_illustration/bold_fantasy',
  //       'digital_illustration/child_book', 'digital_illustration/child_books', 'digital_illustration/cover',
  //       'digital_illustration/crosshatch', 'digital_illustration/digital_engraving', 'digital_illustration/expressionism',
  //       'digital_illustration/freehand_details', 'digital_illustration/grain_20', 'digital_illustration/graphic_intensity',
  //       'digital_illustration/hard_comics', 'digital_illustration/long_shadow', 'digital_illustration/modern_folk',
  //       'digital_illustration/multicolor', 'digital_illustration/neon_calm', 'digital_illustration/noir',
  //       'digital_illustration/nostalgic_pastel', 'digital_illustration/outline_details', 'digital_illustration/pastel_gradient',
  //       'digital_illustration/pastel_sketch', 'digital_illustration/pop_art', 'digital_illustration/pop_renaissance',
  //       'digital_illustration/street_art', 'digital_illustration/tablet_sketch', 'digital_illustration/urban_glow',
  //       'digital_illustration/urban_sketching', 'digital_illustration/vanilla_dreams', 'digital_illustration/young_adult_book',
  //       'digital_illustration/young_adult_book_2', 'vector_illustration/bold_stroke', 'vector_illustration/chemistry',
  //       'vector_illustration/colored_stencil', 'vector_illustration/contour_pop_art', 'vector_illustration/cosmics',
  //       'vector_illustration/cutout', 'vector_illustration/depressive', 'vector_illustration/editorial',
  //       'vector_illustration/emotional_flat', 'vector_illustration/infographical', 'vector_illustration/marker_outline',
  //       'vector_illustration/mosaic', 'vector_illustration/naivector', 'vector_illustration/roundish_flat',
  //       'vector_illustration/segmented_colors', 'vector_illustration/sharp_contrast', 'vector_illustration/thin',
  //       'vector_illustration/vector_photo', 'vector_illustration/vivid_shapes', 'vector_illustration/engraving',
  //       'vector_illustration/line_art', 'vector_illustration/line_circuit', 'vector_illustration/linocut'
  //     ] },
  //     // { label: t('designStudio.parameters.width'),  key: 'image_size.width',  type: 'input' },
  //     // { label: t('designStudio.parameters.height'), key: 'image_size.height', type: 'input' },
  //   ]
  // }

  // hugingface all models
  if (engine.value === 'huggingface') {
      return [
        { label: t('designStudio.parameters.negativePrompt'), key: 'negative_prompt', type: 'textarea' },
        { label: t('designStudio.parameters.width'),  key: 'width',  type: 'input' },
        { label: t('designStudio.parameters.height'), key: 'height', type: 'input' },
      ]
    }

  // // sdwebui all models
  // if (engine.value === 'sdwebui') {
  //   return [
  //     { label: t('designStudio.parameters.negativePrompt'), key: 'negative_prompt', type: 'textarea' },
  //     { label: t('designStudio.parameters.width'),  key: 'width',  type: 'input' },
  //     { label: t('designStudio.parameters.height'), key: 'height', type: 'input' },
  //   ]
  // }

  // default
  return []

})

const modelHasCustomParams = computed(() => {
  return customParams.value.length > 0
})

const modelHasUserParams = computed(() => {
  return ['replicate', 'falai', 'sdwebui']. includes(engine.value)
})

const modelHasParams = computed(() => {
  return modelHasUserParams.value || modelHasCustomParams.value
})

const canTransform = computed(() => {
  return ['falai', 'replicate'].includes(engine.value) ||
    //(engine.value === 'google' && mediaType.value === 'image' && !props.currentMedia?.isVideo()) ||
    (engine.value === 'openai' && model.value.startsWith('gpt-image-') && mediaType.value === 'image' && !props.currentMedia?.isVideo()) ||
    (engine.value === 'google' && (model.value.includes('-image') || model.value.includes('nano-banana')) && mediaType.value === 'image' && !props.currentMedia?.isVideo()) ||
    (engine.value === 'xai')
})

const canUpload = computed(() => {
  return canEdit.value || canTransform.value
})

const canDraw = computed(() => {
  return mediaType.value === 'image'
})

const isEditing = computed(() => {
  return props.currentMedia != null && transform.value && mediaType.value === 'image' && !props.currentMedia?.isVideo()
})

const replicateModelsLink = computed(() => {
  let collection = 'text-to-image'
  if (mediaType.value === 'image' && transform.value) {
    collection = 'image-editing'
  } else if (mediaType.value === 'video') {
    collection = 'text-to-video'
  }
  return `https://replicate.com/collections/${collection}`
})

const falaiModelsLink = computed(() => {
  let categories = 'text-to-image'
  if (mediaType.value === 'image' && transform.value) {
    categories = 'image-to-image'
  } else if (mediaType.value === 'video' && !transform.value) {
    categories = 'text-to-video'
  } else if (mediaType.value === 'video' && transform.value && !props.currentMedia?.isVideo()) {
    categories = 'image-to-video'
  } else if (mediaType.value === 'video' && transform.value && props.currentMedia?.isVideo()) {
    categories = 'video-to-video'
  }
  return `https://fal.ai/models?categories=${categories}`
})

const isFavorite = computed(() => {
  return store.config.studio.favorites.find((f) => f.engine === engine.value && f.model === model.value) != null
})

const setInputImageKey = (key: string) => {
  params.value[key] = kReferenceParamValue
}

onMounted(() => {

  mediaType.value = store.config.studio.type || 'image'
  engine.value = store.config.studio.engines?.[modelType.value] || (mediaType.value === 'image' ? 'openai' : 'replicate')
  model.value = store.config.engines[engine.value]?.model?.[modelType.value] || (mediaType.value === 'image' ? 'gpt-image-1' : '')
  onLoadDefaults()

  watch(() => props.currentMedia, () => {
    if (!props.currentMedia) {
      transform.value = false
      preserve.value = false
    }
  }, { immediate: true  })

})

const onChangeMediaType = () => {
  engine.value = store.config.studio.engines?.[modelType.value] || engines.value[0]?.id
  model.value = store.config.engines?.[engine.value]?.model?.[modelType.value] || models.value[0]?.id
  onChangeModel()
}

const onChangeEngine = () => {
  model.value = store.config.engines?.[engine.value]?.model?.[modelType.value] || models.value[0]?.id
  onChangeModel()
}

const onChangeTransform = () => {

  // if current model is valid then all good
  if (model.value && models.value.find((m) => m.id === model.value)) {
    // model is valid
  } else {
    const configModel = store.config.engines?.[engine.value]?.model?.[modelType.value]
    if (configModel && models.value.find((m) => m.id === configModel)) {
      model.value = configModel
    } else {
      model.value = models.value[0]?.id
    }
  }
  onChangeModel()
}

const onChangeModel = () => {
  // imageToVideo.value = false
  if (!canTransform.value) {
    transform.value = false
  }
  onLoadDefaults()
  saveSettings()
}

const getModels = async (): Promise<boolean> => {

  // do it
  let loader = ModelLoaderFactory.create(store.config, engine.value)
  let success = await loader.loadModels()
  if (!success) {
    Dialog.alert(t('common.errorModelRefresh'))
    return false
  }

  // make sure we have a valid model
  if (!models.value.find((m) => m.id === model.value)) {
    model.value = models.value[0]?.id
  }

  // done
  store.saveSettings()
  return true

}

const onShowPromptLibrary = (event: MouseEvent) => {
  showPromptLibrary.value = true
  menuX.value = event.clientX + 16
  menuY.value = event.clientY - 12
}

const onRunPromptLibrary = (action: string) => {
  showPromptLibrary.value = false
  const libraryPrompt = promptLibrary.value.find((a: any) => a.action === action)
  if (libraryPrompt) prompt.value = libraryPrompt.prompt
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
  const savedDefaults = store.config.studio.defaults.find((d) => d.engine === engine.value && d.model === model.value)
  params.value = savedDefaults ? JSON.parse(JSON.stringify(savedDefaults?.params)) : {}
  if (Object.keys(params.value).length > 0) {
    showParams.value = true
  }
}

const onSaveDefaults = () => {
  onClearDefaults()
  store.config.studio.defaults.push({
    engine: engine.value,
    model: model.value,
    params: params.value,
  })
  store.saveSettings()
}

const onClearDefaults = () => {
  store.config.studio.defaults = store.config.studio.defaults.filter((d) => d.engine !== engine.value || d.model !== model.value)
  store.saveSettings()
}

const toggleFavorite = () => {
  if (isFavorite.value) {
    store.config.studio.favorites = store.config.studio.favorites.filter((f) => f.engine !== engine.value || f.model !== model.value)
  } else {
    store.config.studio.favorites.push({ engine: engine.value, model: model.value })
  }
  store.saveSettings()
}

const loadSettings = (settings: any) => {
  mediaType.value = settings.mediaType || mediaType.value
  engine.value = settings.engine || engine.value
  model.value = settings.model || model.value
  prompt.value = settings.prompt || prompt.value
  params.value = settings.params || {}
  showParams.value = Object.values(params.value).filter(v => v != kReferenceParamValue).length > 0
  saveSettings()
}

const saveSettings = () => {
  store.config.studio.type = mediaType.value
  store.config.studio.engines[modelType.value] = engine.value,
  store.config.engines[engine.value].model[modelType.value] = model.value
  store.saveSettings()
}

const generateMedia = async () => {

  // check prompt
  const userPrompt = prompt.value.trim()
  if (!transform.value && !userPrompt) {
    Dialog.show({
      title: t('common.error'),
      text: t('designStudio.error.promptRequired'),
    })
    return
  }

  // overwrite
  let action = 'create'
  if (transform.value) {
    if (mediaType.value === 'image' && !props.currentMedia?.isVideo()) {
      action = preserve.value ? 'transform' : 'edit'
    } else {
      action = 'transform'
    }
  }

  // emit
  emit('generate', {
    action: action,
    mediaType: mediaType.value,
    engine: engine.value,
    model: model.value,
    prompt: userPrompt,
    attachments: attachments.value,
    params: params.value
  })
}

defineExpose({
  reset: () => {
    attachments.value = []
    transform.value = false
  },
  loadSettings,
  generateMedia,
  setInputImageKey,
  setTransform: (value: boolean) => {
    transform.value = value
    onChangeMediaType()
  },
})

</script>

<style scoped>

.studio-settings {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;

  main {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    margin-bottom: 1rem;
    padding-right: 1rem;
  }

  footer {
    flex-shrink: 0;
  }
}

.split-pane .sp-sidebar {
  main, footer {
    padding: 0rem;
  }
}

.studio-settings .form .form-field label:has(svg) {
  width: 100%;
  svg {
    float: right;
    cursor: pointer;
  }
}

.studio-settings .form .form-field .form-subgroup {
  display: flex;
  width: 100%;
}

.studio-settings .form .form-field textarea {
  flex: auto;
  min-height: 2rem;
  height: 4rem;
  resize: vertical;
  background-color: var(--control-textarea-bg-color);
}

.studio-settings .info {
  align-self: flex-start;
  margin-top: 0.25rem;
  margin-bottom: 0.5rem;
}

.studio-settings .list-with-actions {
  margin-top: 0.5rem;
  width: 100%;
}

.studio-settings .form .form-field label.expander {
  margin-top: -0.5rem;
  cursor: pointer;
}

.studio-settings .sticky-table-container {
  height: 100px;
}

.studio-settings .sticky-table-container td {
  max-width: 60px;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.studio-settings .error {
  color: red;
}

.studio-settings .attachments {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 0.5rem;
  gap: 0.5rem;

  .attachment {
    
    padding: 0.5rem 0.25rem;
    border: 1px solid var(--prompt-input-border-color);
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;

    &:has(img) {
      padding: 0.125rem 0.25rem;
    }

    .icon {
      height: 1.25rem !important;
      width: 1.25rem !important;
    }

    img {
      height: 2rem !important;
      width: 2rem !important;
      border-radius: 0.125rem;
      object-fit: cover;
    }

    .title {
      font-size: 0.9rem;
      opacity: 0.8;
    }

    .delete {
      padding-left: 0.25rem;
      cursor: pointer;
    }

  }
}

</style>