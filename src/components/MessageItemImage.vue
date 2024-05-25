<template>
  <div class="image-container">
    <img :src="url" :alt="desc" class="image" @click="onFullscreen" @load="onImageLoaded"/>
    <BIconDownload class="download" @click="onDownload()" />
  </div>
</template>

<script setup>

import { ref, computed } from 'vue'

import useEventBus from '../composables/useEventBus'
const { emitEvent } = useEventBus()

const props = defineProps({
  url: String,
  desc: String
})

const emits = defineEmits(['image-loaded'])

const onImageLoaded = () => {
  emits('image-loaded')
}

const onFullscreen = (url) => {
  emitEvent('fullScreen', props.url)
}

const onDownload = () => {
  window.api.file.download({
    url: props.url,
    properties: {
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