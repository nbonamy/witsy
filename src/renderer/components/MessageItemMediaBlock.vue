<template>
  <div class="media-container">
    <video :src="url" :alt="desc" class="media video" @load="onMediaLoaded" controls v-if="isVideo()"></video>
    <img :src="url" :alt="desc" class="media image" @click="onFullscreen" @load="onMediaLoaded" v-else/>
    <div class="media-actions">
      <InfoIcon v-if="prompt" class="action info" @click="onInfo"/>
      <ClipboardIcon v-if="!isVideo() && !copying" class="action copy" @click="onCopy" />
      <ClipboardCheckIcon v-if="copying" class="action copy" />
      <DownloadIcon class="action download" @click="onDownload" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { ClipboardCheckIcon, ClipboardIcon, DownloadIcon, InfoIcon } from 'lucide-vue-next'
import { ref } from 'vue'
import Dialog from '@renderer/utils/dialog'
import useEventBus from '@composables/event_bus'
import Message from '@models/message'
const { emitEvent } = useEventBus()

const props = defineProps({
  url: {
    type: String,
    required: true,
  },
  desc: String,
  prompt: String
})

const copying = ref(false)

const emits = defineEmits(['media-loaded'])

const isVideo = () => {
  return Message.isVideoUrl(props.url)
}

const onMediaLoaded = () => {
  emits('media-loaded')
}

const onFullscreen = () => {
  emitEvent('fullscreen', props.url)
}

const onInfo = () => {
  Dialog.show({
    title: props.desc,
    text: props.desc == props.prompt ? '' : props.prompt,
  })
}

const onCopy = () => {
  copying.value = true
  window.api.clipboard.writeImage(props.url)
  setTimeout(() => {
    copying.value = false
  }, 1000)
}

const onDownload = () => {
  window.api.file.download({
    url: props.url,
    properties: {
      prompt: true,
      directory: 'downloads',
      filename: `${isVideo() ? 'video' : 'image'}.${props.url.split('.').pop()}`,
    }
  })
}

</script>

<style scoped>

img {
  cursor: pointer;
}

</style>