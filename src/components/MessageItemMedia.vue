<template>
  <div class="media-container">
    <video :src="url" :alt="desc" class="media video" @load="onMediaLoaded" controls v-if="isVideo()"/>
    <img :src="url" :alt="desc" class="media image" @click="onFullscreen" @load="onMediaLoaded" v-else/>
    <div class="media-actions">
      <BIconInfoCircle class="action info" v-if="prompt" @click="onInfo"/>
      <BIconDownload class="action download" @click="onDownload" />
    </div>
  </div>
</template>

<script setup lang="ts">

import Dialog from '../composables/dialog'
import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

const props = defineProps({
  url: {
    type: String,
    required: true,
  },
  desc: String,
  prompt: String
})

const emits = defineEmits(['media-loaded'])

const isVideo = () => {
  return props.url.endsWith('.mp4') || props.url.endsWith('.webm') || props.url.endsWith('.ogg')
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
    text: props.prompt,
  })
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