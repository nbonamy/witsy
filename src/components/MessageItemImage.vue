<template>
  <div class="image-container">
    <img :src="url" :alt="desc" class="image" @click="onFullscreen" @load="onImageLoaded"/>
    <BIconDownload class="download" @click="onDownload()" />
  </div>
</template>

<script setup lang="ts">

import useEventBus from '../composables/event_bus'
const { emitEvent } = useEventBus()

const props = defineProps({
  url: String,
  desc: String
})

const emits = defineEmits(['image-loaded'])

const onImageLoaded = () => {
  emits('image-loaded')
}

const onFullscreen = () => {
  emitEvent('fullscreen', props.url)
}

const onDownload = () => {
  window.api.file.download({
    url: props.url,
    properties: {
      prompt: true,
      directory: 'downloads',
      filename: 'image.png',
    }
  })
}

</script>

<style scoped>

img {
  cursor: pointer;
}

</style>