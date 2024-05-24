<template>
  <div class="image-container">
    <img :src="imageUrl" class="image" @click="onFullscreen(imageUrl)" @load="onImageLoaded()"/>
    <BIconDownload class="download" @click="onDownload()" />
  </div>
</template>

<script setup>

import { ref, computed } from 'vue'

import useEventBus from '../composables/useEventBus'
const { emitEvent } = useEventBus()

const props = defineProps({
  imageUrl: String,
})

const emits = defineEmits(['image-loaded'])

const onImageLoaded = () => {
  emits('image-loaded')
}

const onFullscreen = (url) => {
  emitEvent('fullScreen', url)
}

const onDownload = () => {
  console.log('download', props.imageUrl)
  window.api.file.download({
    url: props.imageUrl,
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