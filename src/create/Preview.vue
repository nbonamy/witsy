<template>
  <div class="preview content">
    <div class="toolbar">
      <template v-if="message">
        <div class="title">{{ message.content }}</div>
        <div class="action undo" @click="$emit('undo')" v-if="canUndo || canRedo" :class="{ disabled: isGenerating || !canUndo }">
          <BIconArrowCounterclockwise />
        </div>
        <div class="action redo" @click="$emit('redo')" v-if="canUndo || canRedo" :class="{ disabled: isGenerating || !canRedo }">
          <BIconArrowClockwise />
        </div>
        <div class="action info" @click="onInfo">
          <BIconInfoCircle />
        </div>
        <div class="action fullscreen" @click="onFullScreen" v-if="!message.isVideo()">
          <BIconFullscreen />
        </div>
        <div class="action copy" @click="onCopy" v-if="!message.isVideo()">
          <BIconClipboardCheck v-if="copying" />
          <BIconClipboard v-else />
        </div>
        <div class="action save" @click="onDownload">
          <BIconDownload />
        </div>
        <div class="action delete" @click="onDelete">
          <BIconTrash />
        </div>
      </template>
    </div>
    <div v-if="!message" class="empty">
      <span v-if="isGenerating">{{ t('designStudio.generating') }}</span>
      <span v-else>{{ t('designStudio.emptyPlaceholder') }}</span>
    </div>
    <div v-else class="media">
      <video v-if="message.isVideo()" :src="message.attachment.url" :alt="message.content" class="video" controls />
      <img v-else :src="message.attachment.url" @click="onFullScreen" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'
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
  },
  canUndo: {
    type: Boolean,
    default: false
  },
  canRedo: {
    type: Boolean,
    default: false
  }
})

const copying = ref(false)

const emit = defineEmits(['fullscreen', 'delete', 'undo', 'redo'])

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

const onCopy = async () => {
  if (!props.message || props.message.isVideo()) return
  copying.value = true
  await window.api.clipboard.writeImage(props.message.attachment.url)
  setTimeout(() => {
    copying.value = false
  }, 1000)
}

const onDownload = () => {
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

const onDelete = () => {
  if (!props.message) return
  emit('delete', props.message)
}

</script>

<style scoped>
@import '../../css/panel-content.css';
</style>

<style scoped>

.preview {
  
  width: calc(100% - var(--create-panel-width));
  --preview-padding: 32px;

  .empty {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    line-height: 300%;
    padding: 0px 64px;
    color: var(--text-color) !important;
    opacity: 0.8;
    text-align: center;
 
    span {
      font-family: Garamond, Georgia, Times, 'Times New Roman', serif;
      font-style: italic;
      font-size: 24pt;
    }

  }

  .media {
    width: calc(100% - var(--preview-padding) * 2);
    height: calc(100% - var(--toolbar-height) - var(--preview-padding) * 2);
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: var(--preview-padding);
    -webkit-app-region: no-drag;

    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      cursor: pointer;
    }
  }
}

</style>
