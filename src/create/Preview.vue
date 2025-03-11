<template>
  <div class="preview">
    <div class="toolbar">
      <template v-if="message">
        <div class="title">{{ message.content }}</div>
        <div class="action info" @click="onInfo">
          <BIconInfoCircle />
        </div>
        <div class="action fullscreen" @click="onFullScreen" v-if="!message.isVideo()">
          <BIconFullscreen />
        </div>
        <div class="action save" @click="onDownload">
          <BIconDownload />
        </div>
      </template>
    </div>
    <div v-if="!message" class="empty">
      <span v-if="isGenerating">{{ t('createMedia.generating') }}</span>
      <span v-else>{{ t('createMedia.emptyPlaceholder') }}</span>
    </div>
    <div v-else class="media">
      <video v-if="message.isVideo()" :src="message.attachment.url" :alt="message.content" class="video" controls />
      <img v-else :src="message.attachment.url" @click="onFullScreen" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '../services/i18n'
import Message from '../models/message'
import Dialog from '../composables/dialog'

const props = defineProps({
  message: {
    type: Object as () => Message,
    default: null
  },
  isGenerating: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['fullscreen'])

const onInfo = () => {
  if (!props.message) return

  // we need to build the text
  let text = `Engine: ${props.message.engine}\nModel: ${props.message.model}`

  // add extra params
  if (props.message.toolCall?.calls) {
    props.message.toolCall.calls.forEach((call) => {
      Object.keys(call.params).forEach((key) => {
        text += `\n${key}: ${call.params[key]}`
      })
    })
  }

  Dialog.show({
    title: props.message.content,
    text: text,
  })
}

const onFullScreen = () => {
  if (!props.message) return
  emit('fullscreen', props.message.attachment.url)
}

const onDownload = () => {
  console.log(props.message)
  const url = props.message.attachment.url
  window.api.file.download({
    url: url,
    properties: {
      prompt: true,
      directory: 'downloads',
      filename: `${props.message.isVideo() ? 'video' : 'image'}.${url.split('.').pop()}`,
    }
  })
}
</script>

<style scoped>
.preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--control-bg-color);

  --toolbar-height: 48px;
  --toolbar-padding: 16px;
  --preview-padding: 32px;
}

.preview .toolbar {
  padding: 16px;
  flex-basis: calc(var(--toolbar-height) - var(--toolbar-padding) * 2); 
  background-color: var(--chatarea-toolbar-bg-color);
  -webkit-app-region: drag;
  display: flex;
  gap: 16px;
}

.preview .toolbar .title {
  flex: 1;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-left: 8px;
  color: var(--chatarea-toolbar-text-color);
}

.preview .toolbar .action {
  -webkit-app-region: no-drag;
  cursor: pointer;
  text-align: right;
  width: 16px;
  height: 16px;
  color: var(--chatarea-toolbar-icon-color);
  fill: var(--chatarea-toolbar-icon-color);
}

.preview .empty {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  line-height: 300%;
  padding: 0px 64px;
  color: var(--text-color) !important;
  opacity: 0.8;
  text-align: center;
}

.preview .empty span {
  font-family: Garamond, Georgia, Times, 'Times New Roman', serif;
  font-style: italic;
  font-size: 24pt;
}

.preview .media {
  width: calc(100% - var(--preview-padding) * 2);
  height: calc(100% - var(--toolbar-height) - var(--preview-padding) * 2);
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: var(--preview-padding);
  -webkit-app-region: no-drag;
}

.preview .media img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  cursor: pointer;
}
</style>